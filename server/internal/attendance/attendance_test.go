package attendance

import (
	"context"
	"testing"

	"atapp/config"
	"atapp/db"
	"atapp/internal/admin"
	"atapp/internal/auth"
	"atapp/internal/event"
	"atapp/internal/session"
)

func TestAttendanceReportingFlow(t *testing.T) {
	// 1. Setup DB connection as admin to reset schema and onboard a college.
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

	var collegeID string
	err = dbConnAdmin.QueryRow("INSERT INTO colleges (name) VALUES ('Attendance Test College') RETURNING id").Scan(&collegeID)
	if err != nil {
		dbConnAdmin.Close()
		t.Fatalf("Failed to insert test college: %v", err)
	}
	dbConnAdmin.Close()

	// 2. Connect as app_user (RLS user).
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

	rdb, err := db.ConnectRedis("localhost:6380")
	if err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer rdb.Close()
	ctx := context.Background()
	_ = rdb.FlushAll(ctx).Err()

	// 3. Initialize services.
	jwtCfg := config.Config{JWTSecret: "my-test-jwt-secret-key-must-be-long-enough-32-chars"}
	noOpBus := event.NewNoOpEventBus()

	authSvc := auth.NewService(dbConn, jwtCfg)
	adminSvc := admin.NewService(dbConn)
	sessionSvc := session.NewService(dbConn, rdb, noOpBus)
	attendanceSvc := NewService(dbConn, noOpBus)

	// 4. Set up teacher, another teacher, a student, and a section.
	teacher, err := authSvc.SignUp(ctx, collegeID, "teacher", "Dr. Grace", "grace@attendance.edu", "teacher123")
	if err != nil {
		t.Fatalf("Failed to sign up teacher: %v", err)
	}
	otherTeacher, err := authSvc.SignUp(ctx, collegeID, "teacher", "Dr. Heidi", "heidi@attendance.edu", "teacher123")
	if err != nil {
		t.Fatalf("Failed to sign up other teacher: %v", err)
	}
	student, err := authSvc.SignUp(ctx, collegeID, "student", "Ivan", "ivan@attendance.edu", "student123")
	if err != nil {
		t.Fatalf("Failed to sign up student: %v", err)
	}

	deptID, err := adminSvc.CreateDepartment(ctx, collegeID, "Physics")
	if err != nil {
		t.Fatalf("Failed to create department: %v", err)
	}
	courseID, err := adminSvc.CreateCourse(ctx, collegeID, deptID, "Quantum Mechanics", "PHYS301", nil)
	if err != nil {
		t.Fatalf("Failed to create course: %v", err)
	}
	sectionID, err := adminSvc.CreateSection(ctx, collegeID, courseID, "Fall 2026", teacher.ID, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("Failed to create section: %v", err)
	}

	// Enroll the student directly (no CSV import needed for this test).
	// RLS requires the tenant context to be set within the same transaction.
	enrollTx, err := dbConn.Begin()
	if err != nil {
		t.Fatalf("Failed to begin enrollment transaction: %v", err)
	}
	if err := db.WithTenant(enrollTx, collegeID); err != nil {
		t.Fatalf("Failed to set tenant context: %v", err)
	}
	if _, err := enrollTx.Exec("INSERT INTO enrollments (college_id, student_id, section_id) VALUES ($1, $2, $3)", collegeID, student.ID, sectionID); err != nil {
		t.Fatalf("Failed to enroll student: %v", err)
	}
	if err := enrollTx.Commit(); err != nil {
		t.Fatalf("Failed to commit enrollment: %v", err)
	}

	// 5. Before any session exists, teacher's sections list should include
	// this section, with none started yet, and history should be empty.
	sections, err := attendanceSvc.GetTeacherSections(ctx, collegeID, teacher.ID)
	if err != nil {
		t.Fatalf("GetTeacherSections failed: %v", err)
	}
	if len(sections) != 1 || sections[0].SectionID != sectionID {
		t.Errorf("Expected exactly the one section owned by the teacher, got: %+v", sections)
	}

	history, err := attendanceSvc.GetSectionHistory(ctx, collegeID, sectionID, teacher.ID)
	if err != nil {
		t.Fatalf("GetSectionHistory failed: %v", err)
	}
	if len(history) != 0 {
		t.Errorf("Expected no session history yet, got: %+v", history)
	}

	// A teacher who doesn't own the section must be denied.
	if _, err := attendanceSvc.GetSectionHistory(ctx, collegeID, sectionID, otherTeacher.ID); err == nil {
		t.Error("Expected GetSectionHistory to deny a teacher who doesn't own the section")
	}
	if _, err := attendanceSvc.GetSectionDashboard(ctx, collegeID, sectionID, otherTeacher.ID); err == nil {
		t.Error("Expected GetSectionDashboard to deny a teacher who doesn't own the section")
	}

	// 6. Start a session so we have something to build a roster/history from.
	startRes, err := sessionSvc.StartSession(ctx, collegeID, teacher.ID, sectionID, nil, nil, nil)
	if err != nil {
		t.Fatalf("Failed to start session: %v", err)
	}

	roster, err := attendanceSvc.GetSessionRoster(ctx, collegeID, startRes.SessionID, teacher.ID)
	if err != nil {
		t.Fatalf("GetSessionRoster failed: %v", err)
	}
	if len(roster) != 1 || roster[0].StudentID != student.ID || roster[0].Status != "pending" {
		t.Errorf("Expected one pending roster entry for the student, got: %+v", roster)
	}

	// A non-owning teacher cannot view the roster.
	if _, err := attendanceSvc.GetSessionRoster(ctx, collegeID, startRes.SessionID, otherTeacher.ID); err == nil {
		t.Error("Expected GetSessionRoster to deny a teacher who doesn't own the section")
	}

	// 7. Override the student's attendance to present, then end the session.
	overrideRes, err := attendanceSvc.SubmitOverride(ctx, collegeID, teacher.ID, startRes.SessionID, student.ID, "overridden_present", "manual credit")
	if err != nil {
		t.Fatalf("SubmitOverride failed: %v", err)
	}
	if overrideRes.Status != "overridden_present" {
		t.Errorf("Expected overridden_present, got %s", overrideRes.Status)
	}

	if _, err := attendanceSvc.SubmitOverride(ctx, collegeID, teacher.ID, startRes.SessionID, student.ID, "bogus_status", "x"); err == nil {
		t.Error("Expected SubmitOverride to reject an invalid status")
	}

	if _, err := sessionSvc.EndSession(ctx, collegeID, teacher.ID, startRes.SessionID); err != nil {
		t.Fatalf("Failed to end session: %v", err)
	}

	// 8. Dashboard and history should now reflect the ended session.
	dashboard, err := attendanceSvc.GetSectionDashboard(ctx, collegeID, sectionID, teacher.ID)
	if err != nil {
		t.Fatalf("GetSectionDashboard failed: %v", err)
	}
	if len(dashboard) != 1 || dashboard[0].StudentID != student.ID {
		t.Errorf("Expected one dashboard entry for the student, got: %+v", dashboard)
	}

	historyAfter, err := attendanceSvc.GetSectionHistory(ctx, collegeID, sectionID, teacher.ID)
	if err != nil {
		t.Fatalf("GetSectionHistory failed: %v", err)
	}
	if len(historyAfter) != 1 || historyAfter[0].SessionID != startRes.SessionID || historyAfter[0].PresentCount != 1 {
		t.Errorf("Expected one ended session with 1 present, got: %+v", historyAfter)
	}
}
