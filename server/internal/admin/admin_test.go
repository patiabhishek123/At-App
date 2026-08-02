package admin

import (
	"context"
	"os"
	"strings"
	"testing"

	"atapp/db"
)

func TestAdminCRUDAndImport(t *testing.T) {
	// Setup DB connection as admin to run migrations and onboard college
	cfg := db.Config{
		Host:     "localhost",
		Port:     5433,
		User:     "atapp_user",
		Password: "atapp_password",
		DBName:   "atapp_db",
		SSLMode:  "disable",
	}

	dbConn, err := db.Connect(cfg)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Apply migration to ensure clean state
	schemaSQL, err := os.ReadFile("../../db/migrations/001_init.sql")
	if err != nil {
		dbConn.Close()
		t.Fatalf("Failed to read migration script: %v", err)
	}
	_, err = dbConn.Exec(string(schemaSQL))
	if err != nil {
		dbConn.Close()
		t.Fatalf("Failed to execute migration script: %v", err)
	}

	// Onboard college
	var collegeID string
	err = dbConn.QueryRow("INSERT INTO colleges (name) VALUES ('MIT University') RETURNING id").Scan(&collegeID)
	if err != nil {
		dbConn.Close()
		t.Fatalf("Failed to insert test college: %v", err)
	}
	dbConn.Close()

	// Connect as app_user (RLS user)
	appDbCfg := db.Config{
		Host:     "localhost",
		Port:     5433,
		User:     "app_user",
		Password: "app_password",
		DBName:   "atapp_db",
		SSLMode:  "disable",
	}
	dbConn, err = db.Connect(appDbCfg)
	if err != nil {
		t.Fatalf("Failed to connect to database as app_user: %v", err)
	}
	defer dbConn.Close()

	service := NewService(dbConn)
	ctx := context.Background()

	// 1. Create Department
	deptID, err := service.CreateDepartment(ctx, collegeID, "Electrical Engineering")
	if err != nil {
		t.Fatalf("CreateDepartment failed: %v", err)
	}
	if deptID == "" {
		t.Error("Expected department ID to be non-empty")
	}

	// 2. Create Course
	threshold := 75.0
	courseID, err := service.CreateCourse(ctx, collegeID, deptID, "Signals & Systems", "EE201", &threshold)
	if err != nil {
		t.Fatalf("CreateCourse failed: %v", err)
	}
	if courseID == "" {
		t.Error("Expected course ID to be non-empty")
	}

	// 3. Bulk Import Users via CSV
	csvData := `role,name,email,password
teacher,Dr. Alice,alice@mit.edu,alicepwd123
student,Bob,bob@mit.edu,bobpwd123
student,John,john@mit.edu,johnpwd123`

	usersImported, err := service.BulkImportUsersCSV(ctx, collegeID, strings.NewReader(csvData))
	if err != nil {
		t.Fatalf("BulkImportUsersCSV failed: %v", err)
	}
	if usersImported != 3 {
		t.Errorf("Expected 3 users imported, got %d", usersImported)
	}

	// Retrieve the teacher ID (using QueryRow inside a transaction bound to the college tenant)
	var teacherID string
	tx, err := dbConn.Begin()
	if err != nil {
		t.Fatalf("Failed to start query transaction: %v", err)
	}
	if err := db.WithTenant(tx, collegeID); err != nil {
		tx.Rollback()
		t.Fatalf("Failed to set tenant for query: %v", err)
	}
	err = tx.QueryRow("SELECT id FROM users WHERE email = 'alice@mit.edu'").Scan(&teacherID)
	tx.Rollback() // Clean up query transaction
	if err != nil {
		t.Fatalf("Failed to retrieve teacher ID: %v", err)
	}

	// 4. Create Section
	bssid := "00:11:22:33:44:55"
	lat, lng, radius := 37.4275, -122.1697, 25.0
	sectionID, err := service.CreateSection(ctx, collegeID, courseID, "Spring 2026", teacherID, &bssid, &lat, &lng, &radius)
	if err != nil {
		t.Fatalf("CreateSection failed: %v", err)
	}
	if sectionID == "" {
		t.Error("Expected section ID to be non-empty")
	}

	// 5. Bulk Import Enrollments via CSV
	enrollmentCSV := `student_email,section_id
bob@mit.edu,` + sectionID + `
john@mit.edu,` + sectionID

	enrollmentsImported, err := service.BulkImportEnrollmentsCSV(ctx, collegeID, strings.NewReader(enrollmentCSV))
	if err != nil {
		t.Fatalf("BulkImportEnrollmentsCSV failed: %v", err)
	}
	if enrollmentsImported != 2 {
		t.Errorf("Expected 2 enrollments imported, got %d", enrollmentsImported)
	}
}
