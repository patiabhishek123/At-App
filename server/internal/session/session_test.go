package session

import (
	"context"
	"os"
	"strings"
	"testing"

	"atapp/config"
	"atapp/db"
	"atapp/internal/admin"
	"atapp/internal/attendance"
	"atapp/internal/auth"
	"atapp/internal/event"
	"atapp/internal/reporting"
	"atapp/internal/verification"
)

func TestSessionAndVerificationFlow(t *testing.T) {
	// 1. Setup DB connection as admin to run migrations and onboard college
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

	// Apply migration to ensure clean state
	schemaSQL, err := os.ReadFile("../../db/migrations/001_init.sql")
	if err != nil {
		dbConnAdmin.Close()
		t.Fatalf("Failed to read migration script: %v", err)
	}
	_, err = dbConnAdmin.Exec(string(schemaSQL))
	if err != nil {
		dbConnAdmin.Close()
		t.Fatalf("Failed to execute migration script: %v", err)
	}

	// Onboard college
	var collegeID string
	err = dbConnAdmin.QueryRow("INSERT INTO colleges (name) VALUES ('MIT University') RETURNING id").Scan(&collegeID)
	if err != nil {
		dbConnAdmin.Close()
		t.Fatalf("Failed to insert test college: %v", err)
	}
	dbConnAdmin.Close()

	// 2. Connect as app_user (RLS user)
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

	// 3. Connect to Redis
	rdb, err := db.ConnectRedis("localhost:6380")
	if err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer rdb.Close()
	ctx := context.Background()
	_ = rdb.FlushAll(ctx).Err() // clean state

	// 4. Initialize services
	jwtCfg := config.Config{
		JWTSecret: "my-test-jwt-secret-key-must-be-long-enough-32-chars",
	}
	noOpBus := event.NewNoOpEventBus()

	authSvc := auth.NewService(dbConn, jwtCfg)
	adminSvc := admin.NewService(dbConn)
	sessionSvc := NewService(dbConn, rdb, noOpBus)
	verifSvc := verification.NewService(dbConn, rdb, noOpBus)
	attendanceSvc := attendance.NewService(dbConn, noOpBus)
	updaterSvc := reporting.NewUpdater(dbConn, noOpBus)

	// 5. SignUp Teacher and 2 Students
	teacherUser, err := authSvc.SignUp(ctx, collegeID, "teacher", "Dr. Bob", "bob@mit.edu", "teacher123")
	if err != nil {
		t.Fatalf("Failed to sign up teacher: %v", err)
	}

	student1User, err := authSvc.SignUp(ctx, collegeID, "student", "Alice", "alice@mit.edu", "student123")
	if err != nil {
		t.Fatalf("Failed to sign up student 1: %v", err)
	}

	student2User, err := authSvc.SignUp(ctx, collegeID, "student", "Charlie", "charlie@mit.edu", "student123")
	if err != nil {
		t.Fatalf("Failed to sign up student 2: %v", err)
	}

	// 6. Create Department, Course, Section (with Wi-Fi & GPS)
	deptID, err := adminSvc.CreateDepartment(ctx, collegeID, "Computer Science")
	if err != nil {
		t.Fatalf("Failed to create department: %v", err)
	}

	threshold := 75.0
	courseID, err := adminSvc.CreateCourse(ctx, collegeID, deptID, "Intro to Go", "CS101", &threshold)
	if err != nil {
		t.Fatalf("Failed to create course: %v", err)
	}

	bssid := "00:0a:95:9d:68:16"
	lat := 42.3601
	lng := -71.0942
	radius := 50.0

	sectionID, err := adminSvc.CreateSection(
		ctx, collegeID, courseID, "Fall 2026", teacherUser.ID,
		&bssid, &lat, &lng, &radius,
	)
	if err != nil {
		t.Fatalf("Failed to create section: %v", err)
	}

	// 7. Enroll Students using CSV bulk import
	enrollCSV := "student_email,section_id\nalice@mit.edu," + sectionID + "\ncharlie@mit.edu," + sectionID + "\n"
	_, err = adminSvc.BulkImportEnrollmentsCSV(ctx, collegeID, strings.NewReader(enrollCSV))
	if err != nil {
		t.Fatalf("Failed to enroll students: %v", err)
	}

	// 8. Start Session (as Teacher Bob)
	res, err := sessionSvc.StartSession(ctx, collegeID, teacherUser.ID, sectionID, nil, nil, nil)
	if err != nil {
		t.Fatalf("Failed to start class session: %v", err)
	}
	if res.SessionID == "" || res.CurrentCode == "" {
		t.Errorf("Expected populated session ID and code, got: %+v", res)
	}

	// 9. Verify checkin for Student 1 (Alice) - Success Case
	res1, err := verifSvc.SubmitCheckin(ctx, collegeID, student1User.ID, res.CurrentCode, bssid, lat, lng)
	if err != nil {
		t.Fatalf("SubmitCheckin failed: %v", err)
	}
	if res1.Result != "accepted" {
		t.Errorf("Expected Alice checkin to be accepted, got %s: %v", res1.Result, res1.RejectionReason)
	}

	// 10. Verify checkin for Student 2 (Charlie) - Failure Case (invalid BSSID)
	res2, err := verifSvc.SubmitCheckin(ctx, collegeID, student2User.ID, res.CurrentCode, "wrong-bssid", lat, lng)
	if err != nil {
		t.Fatalf("SubmitCheckin failed: %v", err)
	}
	if res2.Result != "rejected" {
		t.Errorf("Expected Charlie checkin to be rejected due to BSSID, got %s", res2.Result)
	} else if *res2.RejectionReason != "not connected to the classroom Wi-Fi network" {
		t.Errorf("Expected wifi rejection reason, got %q", *res2.RejectionReason)
	}

	// 11. Verify checkin for Student 2 (Charlie) - Failure Case (outside geofence)
	res3, err := verifSvc.SubmitCheckin(ctx, collegeID, student2User.ID, res.CurrentCode, bssid, 43.0, -72.0)
	if err != nil {
		t.Fatalf("SubmitCheckin failed: %v", err)
	}
	if res3.Result != "rejected" {
		t.Errorf("Expected Charlie checkin to be rejected due to geofence, got %s", res3.Result)
	} else if *res3.RejectionReason != "outside the classroom geofence boundary" {
		t.Errorf("Expected geofence rejection reason, got %q", *res3.RejectionReason)
	}

	// 12. Test Code Rotation
	codeKey := "session:" + res.SessionID + ":code"
	_ = rdb.Del(ctx, codeKey).Err()

	rotatedCode, _, err := sessionSvc.GetOrRotateCode(ctx, collegeID, res.SessionID)
	if err != nil {
		t.Fatalf("Failed to rotate code: %v", err)
	}
	if rotatedCode == res.CurrentCode {
		t.Errorf("Expected rotated code to be different, got %s", rotatedCode)
	}

	// 13. End Session (Bob ends it)
	summary, err := sessionSvc.EndSession(ctx, collegeID, res.SessionID)
	if err != nil {
		t.Fatalf("Failed to end session: %v", err)
	}

	if summary.PresentCount != 1 || summary.AbsentCount != 1 {
		t.Errorf("Expected 1 present and 1 absent, got: %+v", summary)
	}

	// 14. Recalculate aggregates for Alice and Charlie
	err = updaterSvc.UpdateAggregate(ctx, collegeID, student1User.ID, sectionID)
	if err != nil {
		t.Fatalf("Failed to update aggregate for Alice: %v", err)
	}
	err = updaterSvc.UpdateAggregate(ctx, collegeID, student2User.ID, sectionID)
	if err != nil {
		t.Fatalf("Failed to update aggregate for Charlie: %v", err)
	}

	// 15. Verify Student Alice and Charlie courses report
	coursesAlice, err := attendanceSvc.GetStudentCourses(ctx, collegeID, student1User.ID)
	if err != nil {
		t.Fatalf("Failed to get student courses for Alice: %v", err)
	}
	if len(coursesAlice) != 1 || coursesAlice[0].PresentCount != 1 || coursesAlice[0].TotalSessions != 1 || coursesAlice[0].AttendancePct != 100.0 {
		t.Errorf("Unexpected course statistics for Alice: %+v", coursesAlice)
	}

	coursesCharlie, err := attendanceSvc.GetStudentCourses(ctx, collegeID, student2User.ID)
	if err != nil {
		t.Fatalf("Failed to get student courses for Charlie: %v", err)
	}
	if len(coursesCharlie) != 1 || coursesCharlie[0].PresentCount != 0 || coursesCharlie[0].TotalSessions != 1 || coursesCharlie[0].AttendancePct != 0.0 {
		t.Errorf("Unexpected course statistics for Charlie: %+v", coursesCharlie)
	}

	// 16. Teacher bob overrides Charlie's attendance to overridden_present
	overrideRes, err := attendanceSvc.SubmitOverride(
		ctx, collegeID, teacherUser.ID, res.SessionID, student2User.ID,
		"overridden_present", "Charlie was in class but forgot his phone",
	)
	if err != nil {
		t.Fatalf("Failed to submit manual override: %v", err)
	}
	if overrideRes.Status != "overridden_present" {
		t.Errorf("Expected overridden_present, got %s", overrideRes.Status)
	}

	// 17. Re-calculate aggregate for Charlie and verify
	err = updaterSvc.UpdateAggregate(ctx, collegeID, student2User.ID, sectionID)
	if err != nil {
		t.Fatalf("Failed to update aggregate for Charlie post-override: %v", err)
	}

	coursesCharliePost, err := attendanceSvc.GetStudentCourses(ctx, collegeID, student2User.ID)
	if err != nil {
		t.Fatalf("Failed to get student courses post override: %v", err)
	}
	if coursesCharliePost[0].PresentCount != 1 || coursesCharliePost[0].AttendancePct != 100.0 {
		t.Errorf("Expected Charlie present count to be 1 and 100%% after override, got: %+v", coursesCharliePost)
	}
}
