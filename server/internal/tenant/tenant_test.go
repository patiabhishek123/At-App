package tenant

import (
	"context"
	"testing"

	"atapp/db"
)

func TestCreateCollege(t *testing.T) {
	adminCfg := db.Config{
		Host:     "localhost",
		Port:     5433,
		User:     "atapp_user",
		Password: "atapp_password",
		DBName:   "atapp_db",
		SSLMode:  "disable",
	}
	dbConnAdmin, err := db.Connect(adminCfg)
	if err != nil {
		t.Fatalf("Failed to connect to database as admin: %v", err)
	}
	if err := db.ResetSchemaForTests(dbConnAdmin); err != nil {
		dbConnAdmin.Close()
		t.Fatalf("Failed to reset schema: %v", err)
	}
	dbConnAdmin.Close()

	appDbCfg := db.Config{
		Host:     "localhost",
		Port:     5433,
		User:     "app_user",
		Password: "app_password",
		DBName:   "atapp_db",
		SSLMode:  "disable",
	}
	dbConn, err := db.Connect(appDbCfg)
	if err != nil {
		t.Fatalf("Failed to connect to database as app_user: %v", err)
	}
	defer dbConn.Close()

	ctx := context.Background()
	svc := NewService(dbConn)

	// Missing required fields should be rejected before touching the database.
	if _, err := svc.CreateCollege(ctx, "", "Admin", "admin@x.edu", "password1"); err == nil {
		t.Error("Expected an error when name is missing")
	}

	college, err := svc.CreateCollege(ctx, "Onboarding Test College", "Root Admin", "root@onboarding.edu", "supersecret1")
	if err != nil {
		t.Fatalf("CreateCollege failed: %v", err)
	}
	if college.ID == "" || college.AdminUserID == "" {
		t.Fatalf("Expected populated college and admin IDs, got: %+v", college)
	}
	if college.Name != "Onboarding Test College" {
		t.Errorf("Expected name to round-trip, got %q", college.Name)
	}

	// Verify the admin user was created with the right role/email, under
	// this college's own RLS tenant context.
	tx, err := dbConn.Begin()
	if err != nil {
		t.Fatalf("Failed to begin verification transaction: %v", err)
	}
	defer tx.Rollback()
	if err := db.WithTenant(tx, college.ID); err != nil {
		t.Fatalf("Failed to set tenant context: %v", err)
	}

	var role, email string
	err = tx.QueryRow("SELECT role, email FROM users WHERE id = $1", college.AdminUserID).Scan(&role, &email)
	if err != nil {
		t.Fatalf("Failed to look up admin user: %v", err)
	}
	if role != "admin" || email != "root@onboarding.edu" {
		t.Errorf("Expected role=admin email=root@onboarding.edu, got role=%s email=%s", role, email)
	}

	var collegeCount int
	if err := tx.QueryRow("SELECT COUNT(*) FROM colleges").Scan(&collegeCount); err != nil {
		t.Fatalf("Failed to count colleges: %v", err)
	}
	if collegeCount != 1 {
		t.Errorf("Expected RLS to scope to exactly the 1 college created under this tenant context, got %d", collegeCount)
	}
}

func TestCreateCollege_IsolatedFromOtherTenants(t *testing.T) {
	appDbCfg := db.Config{
		Host:     "localhost",
		Port:     5433,
		User:     "app_user",
		Password: "app_password",
		DBName:   "atapp_db",
		SSLMode:  "disable",
	}
	dbConn, err := db.Connect(appDbCfg)
	if err != nil {
		t.Fatalf("Failed to connect to database as app_user: %v", err)
	}
	defer dbConn.Close()

	ctx := context.Background()
	svc := NewService(dbConn)

	collegeA, err := svc.CreateCollege(ctx, "Tenant A", "Admin A", "admina@isolation.edu", "passwordA1")
	if err != nil {
		t.Fatalf("Failed to create Tenant A: %v", err)
	}
	collegeB, err := svc.CreateCollege(ctx, "Tenant B", "Admin B", "adminb@isolation.edu", "passwordB1")
	if err != nil {
		t.Fatalf("Failed to create Tenant B: %v", err)
	}

	// Under Tenant A's context, Tenant B's admin user must not be visible.
	tx, err := dbConn.Begin()
	if err != nil {
		t.Fatalf("Failed to begin transaction: %v", err)
	}
	defer tx.Rollback()
	if err := db.WithTenant(tx, collegeA.ID); err != nil {
		t.Fatalf("Failed to set tenant context: %v", err)
	}

	var count int
	if err := tx.QueryRow("SELECT COUNT(*) FROM users WHERE id = $1", collegeB.AdminUserID).Scan(&count); err != nil {
		t.Fatalf("Failed to query users: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected Tenant B's admin to be invisible under Tenant A's RLS context, got count=%d", count)
	}
}
