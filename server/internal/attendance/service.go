package attendance

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"atapp/db"
	"atapp/internal/event"
)

// Service manages attendance overrides and query reports.
type Service struct {
	dbConn   *sql.DB
	eventBus event.EventBus
}

// NewService instantiates a new Attendance Service.
func NewService(dbConn *sql.DB, eventBus event.EventBus) *Service {
	return &Service{
		dbConn:   dbConn,
		eventBus: eventBus,
	}
}

// OverrideResult holds details of the recorded manual override.
type OverrideResult struct {
	RecordID string `json:"recordId"`
	Status   string `json:"status"`
}

// SubmitOverride records a teacher manual override (present/absent) and audit log under RLS.
func (s *Service) SubmitOverride(ctx context.Context, collegeID, teacherID, sessionID, studentID, status, reason string) (OverrideResult, error) {
	if status != "overridden_present" && status != "overridden_absent" {
		return OverrideResult{}, errors.New("invalid status: must be overridden_present or overridden_absent")
	}

	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return OverrideResult{}, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return OverrideResult{}, err
	}

	// Verify session exists and is taught by this teacher
	var sectionID string
	err = tx.QueryRowContext(ctx, `
		SELECT cs.section_id 
		FROM class_sessions cs 
		JOIN sections sec ON sec.id = cs.section_id
		WHERE cs.id = $1 AND sec.teacher_id = $2
	`, sessionID, teacherID).Scan(&sectionID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return OverrideResult{}, errors.New("class session not found or you are not authorized to override attendance for it")
		}
		return OverrideResult{}, err
	}

	var recordID string
	upsertQuery := `
		INSERT INTO attendance_records (college_id, session_id, student_id, status)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (session_id, student_id)
		DO UPDATE SET status = EXCLUDED.status, recorded_at = NOW()
		RETURNING id
	`
	err = tx.QueryRowContext(ctx, upsertQuery, collegeID, sessionID, studentID, status).Scan(&recordID)
	if err != nil {
		return OverrideResult{}, fmt.Errorf("failed to save override record: %w", err)
	}

	insertOverride := `
		INSERT INTO overrides (college_id, attendance_record_id, overridden_by, reason)
		VALUES ($1, $2, $3, $4)
	`
	_, err = tx.ExecContext(ctx, insertOverride, collegeID, recordID, teacherID, reason)
	if err != nil {
		return OverrideResult{}, fmt.Errorf("failed to save override details: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return OverrideResult{}, err
	}

	// Emit recorded event
	_ = s.eventBus.Publish(ctx, "attendance.recorded", recordID, event.AttendanceRecordedEvent{
		RecordID:   recordID,
		SessionID:  sessionID,
		StudentID:  studentID,
		CollegeID:  collegeID,
		SectionID:  sectionID,
		Status:     status,
		RecordedAt: time.Now(),
	})

	return OverrideResult{
		RecordID: recordID,
		Status:   status,
	}, nil
}

// StudentCourseDTO describes student metrics inside a course section.
type StudentCourseDTO struct {
	SectionID     string  `json:"sectionId"`
	CourseName    string  `json:"courseName"`
	CourseCode    string  `json:"courseCode"`
	PresentCount  int     `json:"presentCount"`
	TotalSessions int     `json:"totalSessions"`
	AttendancePct float64 `json:"attendancePct"`
}

// GetStudentCourses compiles enrolled courses and metrics from aggregates.
func (s *Service) GetStudentCourses(ctx context.Context, collegeID, studentID string) ([]StudentCourseDTO, error) {
	tx, err := s.dbConn.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return nil, err
	}

	query := `
		SELECT 
			e.section_id, c.name, c.code,
			COALESCE(aa.present_count, 0),
			COALESCE(aa.total_sessions, 0),
			COALESCE(aa.attendance_pct, 0.00)
		FROM enrollments e
		JOIN sections s ON s.id = e.section_id
		JOIN courses c ON c.id = s.course_id
		LEFT JOIN attendance_aggregates aa ON aa.student_id = e.student_id AND aa.section_id = e.section_id
		WHERE e.student_id = $1
	`
	rows, err := tx.QueryContext(ctx, query, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to query student metrics: %w", err)
	}
	defer rows.Close()

	var list []StudentCourseDTO
	for rows.Next() {
		var dto StudentCourseDTO
		err := rows.Scan(
			&dto.SectionID, &dto.CourseName, &dto.CourseCode,
			&dto.PresentCount, &dto.TotalSessions, &dto.AttendancePct,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, dto)
	}

	return list, nil
}
