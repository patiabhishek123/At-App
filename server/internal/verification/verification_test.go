package verification

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"atapp/config"
	"atapp/db"
	"atapp/internal/auth"
	"atapp/internal/event"
)

func TestVerificationServiceHardening(t *testing.T) {

	// 1. Setup DB connection as admin
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

	// Insert college with custom policy: NRequired = 2, MaxAttempts = 2
	policy := map[string]interface{}{
		"n_required":   2,
		"max_attempts": 2,
	}
	policyBytes, _ := json.Marshal(policy)

	var collegeID string
	err = dbConnAdmin.QueryRow("INSERT INTO colleges (name, verification_policy) VALUES ('Stanford University', $1) RETURNING id", string(policyBytes)).Scan(&collegeID)
	if err != nil {
		dbConnAdmin.Close()
		t.Fatalf("Failed to insert test college: %v", err)
	}
	dbConnAdmin.Close()

	// 2. Connect as app_user
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
	_ = rdb.FlushAll(ctx).Err()

	// 4. Initialize services
	jwtCfg := config.Config{
		JWTSecret: "my-test-jwt-secret-key-must-be-long-enough-32-chars",
	}
	noOpBus := event.NewNoOpEventBus()

	authSvc := auth.NewService(dbConn, jwtCfg)
	verifSvc := NewService(dbConn, rdb, noOpBus)

	// SignUp Teacher and Student
	teacherUser, err := authSvc.SignUp(ctx, collegeID, "teacher", "Dr. Stanford", "stanford@mit.edu", "teacher123")
	if err != nil {
		t.Fatalf("Failed to sign up teacher: %v", err)
	}

	studentUser, err := authSvc.SignUp(ctx, collegeID, "student", "Edward", "edward@mit.edu", "student123")
	if err != nil {
		t.Fatalf("Failed to sign up student: %v", err)
	}

	// Setup department, course, and section with BSSID and GPS geofence details
	tx, err := dbConn.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("BeginTx failed: %v", err)
	}
	_ = db.WithTenant(tx, collegeID)

	var deptID string
	err = tx.QueryRowContext(ctx, "INSERT INTO departments (college_id, name) VALUES ($1, 'Physics') RETURNING id", collegeID).Scan(&deptID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to create department: %v", err)
	}

	var courseID string
	err = tx.QueryRowContext(ctx, "INSERT INTO courses (college_id, department_id, name, code) VALUES ($1, $2, 'Quantum Mech', 'PHY301') RETURNING id", collegeID, deptID).Scan(&courseID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to create course: %v", err)
	}

	var sectionID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO sections (college_id, course_id, term, teacher_id, classroom_bssid, classroom_geofence_lat, classroom_geofence_lng, classroom_geofence_radius_m)
		VALUES ($1, $2, 'Fall 2026', $3, 'aa:bb:cc:dd:ee:ff', 37.4275, -122.1697, 50.0)
		RETURNING id
	`, collegeID, courseID, teacherUser.ID).Scan(&sectionID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to create section: %v", err)
	}

	// Enroll student
	_, err = tx.ExecContext(ctx, "INSERT INTO enrollments (college_id, student_id, section_id) VALUES ($1, $2, $3)", collegeID, studentUser.ID, sectionID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to enroll student: %v", err)
	}

	// Create class session
	var sessionID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO class_sessions (college_id, section_id, started_by, current_code)
		VALUES ($1, $2, $3, '999999')
		RETURNING id
	`, collegeID, sectionID, teacherUser.ID).Scan(&sessionID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to create session: %v", err)
	}

	err = tx.Commit()
	if err != nil {
		t.Fatalf("Commit failed: %v", err)
	}

	// Set Redis rotating codes
	_ = rdb.Set(ctx, "session:"+sessionID+":code", "999999", 1*time.Hour).Err()

	// 5. Test 1: Check-in fails and hits rate limit after 2 failed attempts
	// Set tenant context for app_user queries
	_, _ = dbConn.Exec("SET app.current_college_id = " + "'" + collegeID + "'")

	// Attempt 1: Invalid code, BSSID, and GPS (rejected)
	res, err := verifSvc.SubmitCheckin(ctx, collegeID, studentUser.ID, "000000", "wrong-bssid", 0.0, 0.0)
	if err != nil {
		t.Fatalf("SubmitCheckin error: %v", err)
	}
	if res.Result != "rejected" || *res.RejectionReason != "invalid or expired class code" {
		t.Errorf("Expected invalid code rejection, got: %s / %v", res.Result, res.RejectionReason)
	}

	// Attempt 2: Invalid code, BSSID, and GPS (rejected, reaches threshold limit of 2)
	res, err = verifSvc.SubmitCheckin(ctx, collegeID, studentUser.ID, "000000", "wrong-bssid", 0.0, 0.0)
	if err != nil {
		t.Fatalf("SubmitCheckin error: %v", err)
	}
	if res.Result != "rejected" || *res.RejectionReason != "invalid or expired class code" {
		t.Errorf("Expected invalid code rejection, got: %s / %v", res.Result, res.RejectionReason)
	}

	// Attempt 3: Now rate limit is reached
	res, err = verifSvc.SubmitCheckin(ctx, collegeID, studentUser.ID, "999999", "aa:bb:cc:dd:ee:ff", 37.4275, -122.1697)
	if err != nil {
		t.Fatalf("SubmitCheckin error: %v", err)
	}
	if res.Result != "rejected" || *res.RejectionReason != "rate limit exceeded: too many failed check-in attempts for this session" {
		t.Errorf("Expected rate limit rejection, got: %s / %v", res.Result, res.RejectionReason)
	}

	// Reset rate limits in Redis for testing N-of-3 signals policy
	_ = rdb.Del(ctx, "rate:student:"+studentUser.ID+":session:"+sessionID).Err()

	// 6. Test 2: N-of-3 signals required = 2.
	// Since N=2, if Code is correct AND BSSID matches, but GPS fails (e.g. student is far away), the check-in should be ACCEPTED!
	// (GPS mismatches but code matches and BSSID matches = 2 matches >= NRequired = 2).
	res, err = verifSvc.SubmitCheckin(ctx, collegeID, studentUser.ID, "999999", "aa:bb:cc:dd:ee:ff", 0.0, 0.0) // far away GPS
	if err != nil {
		t.Fatalf("SubmitCheckin error: %v", err)
	}
	if res.Result != "accepted" {
		t.Errorf("Expected check-in to be accepted under N=2 policy, got: %s (reason: %v)", res.Result, res.RejectionReason)
	}

	// 7. Test 3: Pruning raw location data
	// Manually update the verification_attempts to be older than 24 hours
	_, err = dbConn.Exec("UPDATE verification_attempts SET submitted_at = NOW() - INTERVAL '25 hours'")
	if err != nil {
		t.Fatalf("Failed to age verification attempts: %v", err)
	}

	prunedRows, err := verifSvc.PruneRawVerificationData(ctx, 24*time.Hour)
	if err != nil {
		t.Fatalf("PruneRawVerificationData failed: %v", err)
	}
	if prunedRows == 0 {
		t.Errorf("Expected at least one row to be pruned, got 0")
	}

	// Verify columns have been set to NULL
	var count int
	err = dbConn.QueryRow("SELECT COUNT(*) FROM verification_attempts WHERE raw_bssid IS NOT NULL OR raw_gps_lat IS NOT NULL").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count remaining raw data: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected 0 rows with raw data remaining, got %d", count)
	}
}

func TestLoadCheckinPath(t *testing.T) {
	// Setup DB connection as admin
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
	defer dbConnAdmin.Close()

	// Apply migration to ensure clean state
	schemaSQL, err := os.ReadFile("../../db/migrations/001_init.sql")
	if err != nil {
		t.Fatalf("Failed to read migration script: %v", err)
	}
	_, err = dbConnAdmin.Exec(string(schemaSQL))
	if err != nil {
		t.Fatalf("Failed to execute migration script: %v", err)
	}

	var collegeID string
	err = dbConnAdmin.QueryRow("INSERT INTO colleges (name) VALUES ('Stanford Load Test') RETURNING id").Scan(&collegeID)
	if err != nil {
		t.Fatalf("Failed to insert test college: %v", err)
	}

	// Connect as app_user
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
		t.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	rdb, err := db.ConnectRedis("localhost:6380")
	if err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer rdb.Close()
	ctx := context.Background()
	_ = rdb.FlushAll(ctx).Err()

	jwtCfg := config.Config{
		JWTSecret: "my-test-jwt-secret-key-must-be-long-enough-32-chars",
	}
	noOpBus := event.NewNoOpEventBus()

	authSvc := auth.NewService(dbConn, jwtCfg)
	verifSvc := NewService(dbConn, rdb, noOpBus)

	teacherUser, err := authSvc.SignUp(ctx, collegeID, "teacher", "Dr. Bob Load", "bobload@mit.edu", "teacher123")
	if err != nil {
		t.Fatalf("Failed to sign up teacher: %v", err)
	}

	// Create structure
	tx, err := dbConn.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("BeginTx failed: %v", err)
	}
	_ = db.WithTenant(tx, collegeID)

	var deptID string
	err = tx.QueryRowContext(ctx, "INSERT INTO departments (college_id, name) VALUES ($1, 'Physics') RETURNING id", collegeID).Scan(&deptID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed: %v", err)
	}

	var courseID string
	err = tx.QueryRowContext(ctx, "INSERT INTO courses (college_id, department_id, name, code) VALUES ($1, $2, 'Quantum Mech', 'PHY301') RETURNING id", collegeID, deptID).Scan(&courseID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed: %v", err)
	}

	var sectionID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO sections (college_id, course_id, term, teacher_id, classroom_bssid, classroom_geofence_lat, classroom_geofence_lng, classroom_geofence_radius_m)
		VALUES ($1, $2, 'Fall 2026', $3, 'aa:bb:cc:dd:ee:ff', 37.4275, -122.1697, 50.0)
		RETURNING id
	`, collegeID, courseID, teacherUser.ID).Scan(&sectionID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed: %v", err)
	}

	// Create class session
	var sessionID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO class_sessions (college_id, section_id, started_by, current_code)
		VALUES ($1, $2, $3, '999999')
		RETURNING id
	`, collegeID, sectionID, teacherUser.ID).Scan(&sessionID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed: %v", err)
	}

	err = tx.Commit()
	if err != nil {
		t.Fatalf("Commit failed: %v", err)
	}

	_ = rdb.Set(ctx, "session:"+sessionID+":code", "999999", 1*time.Hour).Err()

	// SignUp 50 students and enroll them
	const studentCount = 50
	studentIDs := make([]string, studentCount)
	for i := 0; i < studentCount; i++ {
		email := fmt.Sprintf("student-%d@mit.edu", i)
		name := fmt.Sprintf("Student %d", i)
		student, err := authSvc.SignUp(ctx, collegeID, "student", name, email, "student123")
		if err != nil {
			t.Fatalf("SignUp failed for student %d: %v", i, err)
		}
		studentIDs[i] = student.ID

		tx, err := dbConn.BeginTx(ctx, nil)
		if err != nil {
			t.Fatalf("BeginTx failed: %v", err)
		}
		_ = db.WithTenant(tx, collegeID)
		_, err = tx.ExecContext(ctx, "INSERT INTO enrollments (college_id, student_id, section_id) VALUES ($1, $2, $3)", collegeID, student.ID, sectionID)
		if err != nil {
			tx.Rollback()
			t.Fatalf("Enrollment failed: %v", err)
		}
		_ = tx.Commit()
	}

	// Concurrent submission
	var wg sync.WaitGroup
	errs := make(chan error, studentCount)

	// Set tenant context for app_user queries
	_, _ = dbConn.Exec("SET app.current_college_id = " + "'" + collegeID + "'")

	for i := 0; i < studentCount; i++ {
		wg.Add(1)
		go func(sID string) {
			defer wg.Done()
			res, err := verifSvc.SubmitCheckin(ctx, collegeID, sID, "999999", "aa:bb:cc:dd:ee:ff", 37.4275, -122.1697)
			if err != nil {
				errs <- err
				return
			}
			if res.Result != "accepted" {
				errs <- fmt.Errorf("expected check-in to be accepted, got: %s (reason: %v)", res.Result, res.RejectionReason)
			}
		}(studentIDs[i])
	}

	wg.Wait()
	close(errs)

	for e := range errs {
		t.Errorf("Error during load test checkin: %v", e)
	}

	// Assert attendance records count in database
	var recordedCount int
	err = dbConnAdmin.QueryRow("SELECT COUNT(*) FROM attendance_records WHERE session_id = $1 AND status = 'present'", sessionID).Scan(&recordedCount)
	if err != nil {
		t.Fatalf("Failed to query attendance count: %v", err)
	}
	if recordedCount != studentCount {
		t.Errorf("Expected %d attendance records, got %d", studentCount, recordedCount)
	}
}

