package admin

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"atapp/db"
	"atapp/internal/auth"
	"atapp/internal/gateway"
	"github.com/go-chi/chi/v5"
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

	// Apply migrations to ensure clean state
	if err := db.ResetSchemaForTests(dbConn); err != nil {
		dbConn.Close()
		t.Fatalf("Failed to reset schema: %v", err)
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
	testAdminAccountCreationRoutes(t, service, collegeID)

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

func testAdminAccountCreationRoutes(t *testing.T, service *Service, collegeID string) {
	t.Helper()

	// The public auth router deliberately has no signup endpoint.
	publicRouter := chi.NewRouter()
	auth.NewHandler(nil).RegisterPublicRoutes(publicRouter, nil)
	publicRequest := httptest.NewRequest(http.MethodPost, "/auth/signup", bytes.NewBufferString(`{
		"collegeId":"attacker-selected", "role":"admin", "name":"Attacker",
		"email":"attacker@example.com", "password":"password"
	}`))
	publicResponse := httptest.NewRecorder()
	publicRouter.ServeHTTP(publicResponse, publicRequest)
	if publicResponse.Code != http.StatusNotFound {
		t.Fatalf("expected public signup to be unavailable, got status %d", publicResponse.Code)
	}

	jwtSecret := []byte("admin-route-test-secret-at-least-32-bytes")
	protectedRouter := chi.NewRouter()
	protectedRouter.Use(gateway.AuthMiddleware(jwtSecret))
	NewHandler(service).RegisterRoutes(protectedRouter)

	requestBody := `{
		"role":"student", "name":"Protected Student",
		"email":"protected@mit.edu", "password":"password123"
	}`

	unauthenticatedRequest := httptest.NewRequest(http.MethodPost, "/admin/users", bytes.NewBufferString(requestBody))
	unauthenticatedResponse := httptest.NewRecorder()
	protectedRouter.ServeHTTP(unauthenticatedResponse, unauthenticatedRequest)
	if unauthenticatedResponse.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated account creation to return 401, got %d", unauthenticatedResponse.Code)
	}

	studentTokens, err := auth.GenerateTokenPair("student-user", "student", collegeID, jwtSecret)
	if err != nil {
		t.Fatalf("failed to create student token: %v", err)
	}
	studentRequest := httptest.NewRequest(http.MethodPost, "/admin/users", bytes.NewBufferString(requestBody))
	studentRequest.Header.Set("Authorization", "Bearer "+studentTokens.AccessToken)
	studentResponse := httptest.NewRecorder()
	protectedRouter.ServeHTTP(studentResponse, studentRequest)
	if studentResponse.Code != http.StatusForbidden {
		t.Fatalf("expected student account creation to return 403, got %d", studentResponse.Code)
	}

	adminTokens, err := auth.GenerateTokenPair("admin-user", "admin", collegeID, jwtSecret)
	if err != nil {
		t.Fatalf("failed to create admin token: %v", err)
	}
	crossTenantRequest := httptest.NewRequest(http.MethodPost, "/admin/users", bytes.NewBufferString(`{
		"collegeId":"attacker-selected", "role":"admin", "name":"Other Tenant Admin",
		"email":"other-admin@example.com", "password":"password123"
	}`))
	crossTenantRequest.Header.Set("Authorization", "Bearer "+adminTokens.AccessToken)
	crossTenantResponse := httptest.NewRecorder()
	protectedRouter.ServeHTTP(crossTenantResponse, crossTenantRequest)
	if crossTenantResponse.Code != http.StatusBadRequest {
		t.Fatalf("expected caller-supplied collegeId to return 400, got %d", crossTenantResponse.Code)
	}

	adminRequest := httptest.NewRequest(http.MethodPost, "/admin/users", bytes.NewBufferString(requestBody))
	adminRequest.Header.Set("Authorization", "Bearer "+adminTokens.AccessToken)
	adminResponse := httptest.NewRecorder()
	protectedRouter.ServeHTTP(adminResponse, adminRequest)
	if adminResponse.Code != http.StatusCreated {
		t.Fatalf("expected authenticated admin account creation to return 201, got %d: %s",
			adminResponse.Code, adminResponse.Body.String())
	}
}
