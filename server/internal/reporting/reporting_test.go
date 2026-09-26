package reporting

import (
	"context"
	"sync"
	"testing"

	"atapp/db"
	"atapp/internal/event"
)

// capturingEventBus records every published event for assertions, instead of
// discarding it (like event.NoOpEventBus) or requiring a real broker (like
// event.KafkaEventBus).
type capturingEventBus struct {
	mu        sync.Mutex
	published []capturedEvent
}

type capturedEvent struct {
	Topic string
	Key   string
	Value interface{}
}

func (b *capturingEventBus) Publish(ctx context.Context, topic string, key string, value interface{}) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.published = append(b.published, capturedEvent{Topic: topic, Key: key, Value: value})
	return nil
}

func (b *capturingEventBus) Close() error { return nil }

var _ event.EventBus = (*capturingEventBus)(nil)

func TestUpdateAggregate(t *testing.T) {
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
	err = dbConnAdmin.QueryRow("INSERT INTO colleges (name) VALUES ('Reporting Test College') RETURNING id").Scan(&collegeID)
	if err != nil {
		dbConnAdmin.Close()
		t.Fatalf("Failed to insert test college: %v", err)
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
	tx, err := dbConn.Begin()
	if err != nil {
		t.Fatalf("Failed to begin setup transaction: %v", err)
	}
	if err := db.WithTenant(tx, collegeID); err != nil {
		t.Fatalf("Failed to set tenant context: %v", err)
	}

	var deptID, courseID, sectionID, teacherID, studentID string
	if err := tx.QueryRow("INSERT INTO departments (college_id, name) VALUES ($1, 'Math') RETURNING id", collegeID).Scan(&deptID); err != nil {
		t.Fatalf("Failed to insert department: %v", err)
	}
	threshold := 90.0 // deliberately high, so a single absence breaches it
	if err := tx.QueryRow(
		"INSERT INTO courses (college_id, department_id, name, code, attendance_threshold_pct) VALUES ($1, $2, 'Calculus', 'MATH201', $3) RETURNING id",
		collegeID, deptID, threshold,
	).Scan(&courseID); err != nil {
		t.Fatalf("Failed to insert course: %v", err)
	}
	if err := tx.QueryRow(
		"INSERT INTO users (college_id, role, name, email, password_hash) VALUES ($1, 'teacher', 'Prof', 'prof@reporting.edu', 'hash') RETURNING id",
		collegeID,
	).Scan(&teacherID); err != nil {
		t.Fatalf("Failed to insert teacher: %v", err)
	}
	if err := tx.QueryRow(
		"INSERT INTO sections (college_id, course_id, term, teacher_id) VALUES ($1, $2, 'Fall 2026', $3) RETURNING id",
		collegeID, courseID, teacherID,
	).Scan(&sectionID); err != nil {
		t.Fatalf("Failed to insert section: %v", err)
	}
	if err := tx.QueryRow(
		"INSERT INTO users (college_id, role, name, email, password_hash) VALUES ($1, 'student', 'Stu', 'stu@reporting.edu', 'hash') RETURNING id",
		collegeID,
	).Scan(&studentID); err != nil {
		t.Fatalf("Failed to insert student: %v", err)
	}

	// Two ended sessions: one present, one absent -> 50% attendance, below
	// the 90% threshold configured above.
	var session1ID, session2ID string
	if err := tx.QueryRow(
		"INSERT INTO class_sessions (college_id, section_id, started_by, current_code, ended_at) VALUES ($1, $2, $3, '111111', NOW()) RETURNING id",
		collegeID, sectionID, teacherID,
	).Scan(&session1ID); err != nil {
		t.Fatalf("Failed to insert session 1: %v", err)
	}
	if err := tx.QueryRow(
		"INSERT INTO class_sessions (college_id, section_id, started_by, current_code, ended_at) VALUES ($1, $2, $3, '222222', NOW()) RETURNING id",
		collegeID, sectionID, teacherID,
	).Scan(&session2ID); err != nil {
		t.Fatalf("Failed to insert session 2: %v", err)
	}
	if _, err := tx.Exec(
		"INSERT INTO attendance_records (college_id, session_id, student_id, status) VALUES ($1, $2, $3, 'present')",
		collegeID, session1ID, studentID,
	); err != nil {
		t.Fatalf("Failed to insert present record: %v", err)
	}
	if _, err := tx.Exec(
		"INSERT INTO attendance_records (college_id, session_id, student_id, status) VALUES ($1, $2, $3, 'absent')",
		collegeID, session2ID, studentID,
	); err != nil {
		t.Fatalf("Failed to insert absent record: %v", err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit setup: %v", err)
	}

	bus := &capturingEventBus{}
	updater := NewUpdater(dbConn, bus)

	if err := updater.UpdateAggregate(ctx, collegeID, studentID, sectionID); err != nil {
		t.Fatalf("UpdateAggregate failed: %v", err)
	}

	readTx, err := dbConn.Begin()
	if err != nil {
		t.Fatalf("Failed to begin read-back transaction: %v", err)
	}
	if err := db.WithTenant(readTx, collegeID); err != nil {
		t.Fatalf("Failed to set tenant context: %v", err)
	}
	var presentCount, totalSessions int
	var attendancePct float64
	err = readTx.QueryRow(
		"SELECT present_count, total_sessions, attendance_pct FROM attendance_aggregates WHERE student_id = $1 AND section_id = $2",
		studentID, sectionID,
	).Scan(&presentCount, &totalSessions, &attendancePct)
	if err != nil {
		t.Fatalf("Failed to read back aggregate: %v", err)
	}
	readTx.Rollback()
	if presentCount != 1 || totalSessions != 2 || attendancePct != 50.0 {
		t.Errorf("Expected present=1 total=2 pct=50.0, got present=%d total=%d pct=%.2f", presentCount, totalSessions, attendancePct)
	}

	// Since 50% < the 90% threshold, a threshold.breached event must have
	// been published.
	bus.mu.Lock()
	defer bus.mu.Unlock()
	if len(bus.published) != 1 {
		t.Fatalf("Expected exactly one published event, got %d: %+v", len(bus.published), bus.published)
	}
	if bus.published[0].Topic != "threshold.breached" {
		t.Errorf("Expected a threshold.breached event, got topic %q", bus.published[0].Topic)
	}
	ev, ok := bus.published[0].Value.(event.ThresholdBreachedEvent)
	if !ok {
		t.Fatalf("Expected event.ThresholdBreachedEvent, got %T", bus.published[0].Value)
	}
	if ev.StudentID != studentID || ev.SectionID != sectionID || ev.CurrentPct != 50.0 || ev.ThresholdPct != threshold {
		t.Errorf("Unexpected event payload: %+v", ev)
	}
}

func TestUpdateAggregate_NoBreachBelowThreshold(t *testing.T) {
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
	defer dbConnAdmin.Close()

	var collegeID string
	err = dbConnAdmin.QueryRow("INSERT INTO colleges (name) VALUES ('Reporting Test College 2') RETURNING id").Scan(&collegeID)
	if err != nil {
		t.Fatalf("Failed to insert test college: %v", err)
	}

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
	tx, err := dbConn.Begin()
	if err != nil {
		t.Fatalf("Failed to begin setup transaction: %v", err)
	}
	if err := db.WithTenant(tx, collegeID); err != nil {
		t.Fatalf("Failed to set tenant context: %v", err)
	}

	var deptID, courseID, sectionID, teacherID, studentID string
	if err := tx.QueryRow("INSERT INTO departments (college_id, name) VALUES ($1, 'Math') RETURNING id", collegeID).Scan(&deptID); err != nil {
		t.Fatalf("Failed to insert department: %v", err)
	}
	threshold := 50.0 // low bar; a single present session clears it
	if err := tx.QueryRow(
		"INSERT INTO courses (college_id, department_id, name, code, attendance_threshold_pct) VALUES ($1, $2, 'Calculus', 'MATH202', $3) RETURNING id",
		collegeID, deptID, threshold,
	).Scan(&courseID); err != nil {
		t.Fatalf("Failed to insert course: %v", err)
	}
	if err := tx.QueryRow(
		"INSERT INTO users (college_id, role, name, email, password_hash) VALUES ($1, 'teacher', 'Prof2', 'prof2@reporting.edu', 'hash') RETURNING id",
		collegeID,
	).Scan(&teacherID); err != nil {
		t.Fatalf("Failed to insert teacher: %v", err)
	}
	if err := tx.QueryRow(
		"INSERT INTO sections (college_id, course_id, term, teacher_id) VALUES ($1, $2, 'Fall 2026', $3) RETURNING id",
		collegeID, courseID, teacherID,
	).Scan(&sectionID); err != nil {
		t.Fatalf("Failed to insert section: %v", err)
	}
	if err := tx.QueryRow(
		"INSERT INTO users (college_id, role, name, email, password_hash) VALUES ($1, 'student', 'Stu2', 'stu2@reporting.edu', 'hash') RETURNING id",
		collegeID,
	).Scan(&studentID); err != nil {
		t.Fatalf("Failed to insert student: %v", err)
	}
	var sessionID string
	if err := tx.QueryRow(
		"INSERT INTO class_sessions (college_id, section_id, started_by, current_code, ended_at) VALUES ($1, $2, $3, '333333', NOW()) RETURNING id",
		collegeID, sectionID, teacherID,
	).Scan(&sessionID); err != nil {
		t.Fatalf("Failed to insert session: %v", err)
	}
	if _, err := tx.Exec(
		"INSERT INTO attendance_records (college_id, session_id, student_id, status) VALUES ($1, $2, $3, 'present')",
		collegeID, sessionID, studentID,
	); err != nil {
		t.Fatalf("Failed to insert present record: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit setup: %v", err)
	}

	bus := &capturingEventBus{}
	updater := NewUpdater(dbConn, bus)
	if err := updater.UpdateAggregate(ctx, collegeID, studentID, sectionID); err != nil {
		t.Fatalf("UpdateAggregate failed: %v", err)
	}

	bus.mu.Lock()
	defer bus.mu.Unlock()
	if len(bus.published) != 0 {
		t.Errorf("Expected no threshold.breached event when above threshold, got: %+v", bus.published)
	}
}
