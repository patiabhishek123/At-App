package session

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"time"

	"atapp/db"
	"atapp/internal/event"
	"github.com/redis/go-redis/v9"
)

// Service provides class session start, end, and code rotation features.
type Service struct {
	dbConn   *sql.DB
	rdb      *redis.Client
	eventBus event.EventBus
}

// NewService instantiates a new Session Service.
func NewService(dbConn *sql.DB, rdb *redis.Client, eventBus event.EventBus) *Service {
	return &Service{
		dbConn:   dbConn,
		rdb:      rdb,
		eventBus: eventBus,
	}
}

// StartSessionResult contains the initial information returned to the teacher.
type StartSessionResult struct {
	SessionID            string
	CurrentCode          string
	CodeExpiresInSeconds int
}

func generateCode() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	return fmt.Sprintf("%06d", n.Int64())
}

// StartSession initializes a new class session under RLS.
func (s *Service) StartSession(ctx context.Context, collegeID, teacherID, sectionID string, lat, lng, radius *float64) (StartSessionResult, error) {
	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return StartSessionResult{}, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return StartSessionResult{}, err
	}

	// Verify section exists and belongs to the teacher
	var exists bool
	err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM sections WHERE id = $1 AND teacher_id = $2)", sectionID, teacherID).Scan(&exists)
	if err != nil {
		return StartSessionResult{}, fmt.Errorf("failed to verify section ownership: %w", err)
	}
	if !exists {
		return StartSessionResult{}, errors.New("section not found or not assigned to you")
	}

	// Verify no active session currently exists for this section
	var activeExists bool
	err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM class_sessions WHERE section_id = $1 AND ended_at IS NULL)", sectionID).Scan(&activeExists)
	if err != nil {
		return StartSessionResult{}, err
	}
	if activeExists {
		return StartSessionResult{}, errors.New("a session is already active for this section")
	}

	initialCode := generateCode()

	var sessionID string
	query := `
		INSERT INTO class_sessions (
			college_id, section_id, started_by, current_code, 
			geofence_override_lat, geofence_override_lng, geofence_override_radius_m
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	err = tx.QueryRowContext(ctx, query, collegeID, sectionID, teacherID, initialCode, lat, lng, radius).Scan(&sessionID)
	if err != nil {
		return StartSessionResult{}, fmt.Errorf("failed to save class session: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return StartSessionResult{}, err
	}

	// Write code to Redis with 10s TTL
	codeKey := fmt.Sprintf("session:%s:code", sessionID)
	err = s.rdb.Set(ctx, codeKey, initialCode, 10*time.Second).Err()
	if err != nil {
		return StartSessionResult{}, fmt.Errorf("failed to save session code to Redis: %w", err)
	}

	// Emit event
	startedEvent := event.SessionStartedEvent{
		SessionID: sessionID,
		SectionID: sectionID,
		CollegeID: collegeID,
		StartedBy: teacherID,
		StartedAt: time.Now(),
	}
	_ = s.eventBus.Publish(ctx, "session.started", sessionID, startedEvent)

	return StartSessionResult{
		SessionID:            sessionID,
		CurrentCode:          initialCode,
		CodeExpiresInSeconds: 10,
	}, nil
}

// GetOrRotateCode retrieves the current valid code or rotates it if expired.
func (s *Service) GetOrRotateCode(ctx context.Context, collegeID, sessionID string) (string, int, error) {
	codeKey := fmt.Sprintf("session:%s:code", sessionID)
	prevKey := fmt.Sprintf("session:%s:prev", sessionID)

	// If the current code exists in Redis, return it and its remaining TTL
	val, err := s.rdb.Get(ctx, codeKey).Result()
	if err == nil {
		ttl, _ := s.rdb.TTL(ctx, codeKey).Result()
		return val, int(ttl.Seconds()), nil
	}

	// Redis TTL expired, rotate the code in a tenant transaction
	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return "", 0, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return "", 0, err
	}

	var oldCode string
	err = tx.QueryRowContext(ctx, "SELECT current_code FROM class_sessions WHERE id = $1 AND ended_at IS NULL", sessionID).Scan(&oldCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", 0, errors.New("active class session not found")
		}
		return "", 0, err
	}

	newCode := generateCode()
	for newCode == oldCode {
		newCode = generateCode()
	}

	_, err = tx.ExecContext(ctx, "UPDATE class_sessions SET current_code = $1, code_updated_at = NOW() WHERE id = $2", newCode, sessionID)
	if err != nil {
		return "", 0, err
	}

	if err := tx.Commit(); err != nil {
		return "", 0, err
	}

	// Save new code to Redis and store old code in prevKey to accommodate latencies
	_ = s.rdb.Set(ctx, codeKey, newCode, 10*time.Second).Err()
	_ = s.rdb.Set(ctx, prevKey, oldCode, 10*time.Second).Err()

	return newCode, 10, nil
}

// SessionSummary aggregates final session details.
type SessionSummary struct {
	PresentCount  int `json:"presentCount"`
	AbsentCount   int `json:"absentCount"`
	OverrideCount int `json:"overrideCount"`
}

// EndSession closes a session, records absences for non-attendees, and cleans up Redis.
func (s *Service) EndSession(ctx context.Context, collegeID, sessionID string) (SessionSummary, error) {
	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return SessionSummary{}, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return SessionSummary{}, err
	}

	var sectionID string
	var endedAt sql.NullTime
	err = tx.QueryRowContext(ctx, "SELECT section_id, ended_at FROM class_sessions WHERE id = $1", sessionID).Scan(&sectionID, &endedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return SessionSummary{}, errors.New("class session not found")
		}
		return SessionSummary{}, err
	}
	if endedAt.Valid {
		return SessionSummary{}, errors.New("class session is already ended")
	}

	endedTime := time.Now()
	_, err = tx.ExecContext(ctx, "UPDATE class_sessions SET ended_at = $1 WHERE id = $2", endedTime, sessionID)
	if err != nil {
		return SessionSummary{}, fmt.Errorf("failed to save end timestamp: %w", err)
	}

	// Fetch all enrolled student IDs
	rows, err := tx.QueryContext(ctx, "SELECT student_id FROM enrollments WHERE section_id = $1", sectionID)
	if err != nil {
		return SessionSummary{}, err
	}
	defer rows.Close()

	var studentIDs []string
	for rows.Next() {
		var sID string
		if err := rows.Scan(&sID); err == nil {
			studentIDs = append(studentIDs, sID)
		}
	}

	var absentRecordIDs []string
	var absentStudentIDs []string
	for _, studentID := range studentIDs {
		var exists bool
		err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM attendance_records WHERE session_id = $1 AND student_id = $2)", sessionID, studentID).Scan(&exists)
		if err != nil {
			return SessionSummary{}, err
		}
		if !exists {
			var recID string
			err = tx.QueryRowContext(ctx, `
				INSERT INTO attendance_records (college_id, session_id, student_id, status)
				VALUES ($1, $2, $3, 'absent')
				RETURNING id
			`, collegeID, sessionID, studentID).Scan(&recID)
			if err != nil {
				return SessionSummary{}, fmt.Errorf("failed to insert absent record: %w", err)
			}
			absentRecordIDs = append(absentRecordIDs, recID)
			absentStudentIDs = append(absentStudentIDs, studentID)
		}
	}

	var presentCount, absentCount, overrideCount int
	err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM attendance_records WHERE session_id = $1 AND status = 'present'", sessionID).Scan(&presentCount)
	if err != nil {
		return SessionSummary{}, err
	}
	err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM attendance_records WHERE session_id = $1 AND status = 'absent'", sessionID).Scan(&absentCount)
	if err != nil {
		return SessionSummary{}, err
	}
	err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM attendance_records WHERE session_id = $1 AND status IN ('overridden_present', 'overridden_absent')", sessionID).Scan(&overrideCount)
	if err != nil {
		return SessionSummary{}, err
	}

	if err := tx.Commit(); err != nil {
		return SessionSummary{}, err
	}

	// Clean up Redis keys
	_ = s.rdb.Del(ctx, fmt.Sprintf("session:%s:code", sessionID), fmt.Sprintf("session:%s:prev", sessionID))

	// Publish events for newly marked absentees
	for i, recID := range absentRecordIDs {
		_ = s.eventBus.Publish(ctx, "attendance.recorded", recID, event.AttendanceRecordedEvent{
			RecordID:   recID,
			SessionID:  sessionID,
			StudentID:  absentStudentIDs[i],
			CollegeID:  collegeID,
			SectionID:  sectionID,
			Status:     "absent",
			RecordedAt: endedTime,
		})
	}

	// Emit session end event
	_ = s.eventBus.Publish(ctx, "session.ended", sessionID, event.SessionEndedEvent{
		SessionID: sessionID,
		SectionID: sectionID,
		CollegeID: collegeID,
		EndedAt:   endedTime,
	})

	return SessionSummary{
		PresentCount:  presentCount,
		AbsentCount:   absentCount,
		OverrideCount: overrideCount,
	}, nil
}
