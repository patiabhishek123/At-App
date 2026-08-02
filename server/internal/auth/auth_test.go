package auth

import (
	"context"
	"os"
	"testing"

	"atapp/config"
	"atapp/db"
)

func TestAuthFlow(t *testing.T) {
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
	err = dbConn.QueryRow("INSERT INTO colleges (name) VALUES ('Stanford University') RETURNING id").Scan(&collegeID)
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

	appConfig := config.Config{
		JWTSecret: "my-test-jwt-secret-key-must-be-long-enough-32-chars",
	}

	service := NewService(dbConn, appConfig)
	ctx := context.Background()

	// 1. SignUp Student (should succeed under RLS context because SignUp internally handles WithTenant)
	student, err := service.SignUp(ctx, collegeID, "student", "Charlie", "charlie@stanford.edu", "charlie123")
	if err != nil {
		t.Fatalf("SignUp failed: %v", err)
	}
	if student.Name != "Charlie" || student.Role != "student" {
		t.Errorf("Expected Charlie/student, got %s/%s", student.Name, student.Role)
	}

	// 2. SignUp with duplicate email (should fail)
	_, err = service.SignUp(ctx, collegeID, "student", "Charlie Dup", "charlie@stanford.edu", "pass")
	if err == nil {
		t.Error("Expected signup with duplicate email to fail, but it succeeded")
	}

	// 3. Login with correct credentials (bypasses RLS using SECURITY DEFINER helper get_user_for_auth)
	tokens, loggedInUser, err := service.Login(ctx, "charlie@stanford.edu", "charlie123")
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	if loggedInUser.ID != student.ID {
		t.Errorf("Expected logged-in ID %s, got %s", student.ID, loggedInUser.ID)
	}
	if tokens.AccessToken == "" || tokens.RefreshToken == "" {
		t.Error("Expected tokens to be populated")
	}

	// 4. Login with incorrect password
	_, _, err = service.Login(ctx, "charlie@stanford.edu", "wrongpass")
	if err == nil {
		t.Error("Expected login to fail with invalid password, but it succeeded")
	}

	// 5. Login with non-existent email
	_, _, err = service.Login(ctx, "nobody@stanford.edu", "password")
	if err == nil {
		t.Error("Expected login to fail with non-existent email, but it succeeded")
	}

	// 6. Refresh tokens
	refreshed, err := service.Refresh(ctx, tokens.RefreshToken)
	if err != nil {
		t.Fatalf("Token refresh failed: %v", err)
	}
	if refreshed.AccessToken == "" || refreshed.RefreshToken == "" {
		t.Error("Expected refreshed tokens to be populated")
	}
}
