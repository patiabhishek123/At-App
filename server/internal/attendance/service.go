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

// TeacherSectionDTO contains course details taught by a teacher.
type TeacherSectionDTO struct {
	SectionID                string   `json:"sectionId"`
	Term                     string   `json:"term"`
	CourseName               string   `json:"courseName"`
	CourseCode               string   `json:"courseCode"`
	ClassroomBssid           *string  `json:"classroomBssid"`
	ClassroomGeofenceLat     *float64 `json:"classroomGeofenceLat"`
	ClassroomGeofenceLng     *float64 `json:"classroomGeofenceLng"`
	ClassroomGeofenceRadiusM *float64 `json:"classroomGeofenceRadiusM"`
}

// GetTeacherSections retrieves all sections assigned to the specified teacher.
func (s *Service) GetTeacherSections(ctx context.Context, collegeID, teacherID string) ([]TeacherSectionDTO, error) {
	tx, err := s.dbConn.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return nil, err
	}

	query := `
		SELECT s.id, s.term, c.name, c.code,
		       s.classroom_bssid, s.classroom_geofence_lat, s.classroom_geofence_lng, s.classroom_geofence_radius_m
		FROM sections s
		JOIN courses c ON c.id = s.course_id
		WHERE s.teacher_id = $1
	`
	rows, err := tx.QueryContext(ctx, query, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []TeacherSectionDTO
	for rows.Next() {
		var dto TeacherSectionDTO
		err := rows.Scan(
			&dto.SectionID, &dto.Term, &dto.CourseName, &dto.CourseCode,
			&dto.ClassroomBssid, &dto.ClassroomGeofenceLat, &dto.ClassroomGeofenceLng, &dto.ClassroomGeofenceRadiusM,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, dto)
	}

	return list, nil
}

// RosterStudentDTO represents a student in a class session's roster.
type RosterStudentDTO struct {
	StudentID  string     `json:"studentId"`
	Name       string     `json:"name"`
	Email      string     `json:"email"`
	Status     string     `json:"status"` // present, absent, overridden_present, overridden_absent, pending
	RecordedAt *time.Time `json:"recordedAt"`
}

// GetSessionRoster fetches roster details with check-in status for a active/past session.
func (s *Service) GetSessionRoster(ctx context.Context, collegeID, sessionID, teacherID string) ([]RosterStudentDTO, error) {
	tx, err := s.dbConn.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return nil, err
	}

	// Ownership authorization check
	var ownerID string
	err = tx.QueryRowContext(ctx, `
		SELECT s.teacher_id 
		FROM class_sessions cs
		JOIN sections s ON s.id = cs.section_id
		WHERE cs.id = $1
	`, sessionID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("class session not found")
		}
		return nil, err
	}
	if ownerID != teacherID {
		return nil, errors.New("unauthorized: you do not teach this section")
	}

	query := `
		SELECT u.id, u.name, u.email, COALESCE(ar.status, 'pending') as status, ar.recorded_at
		FROM enrollments e
		JOIN users u ON u.id = e.student_id
		LEFT JOIN attendance_records ar ON ar.student_id = u.id AND ar.session_id = $1
		WHERE e.section_id = (SELECT section_id FROM class_sessions WHERE id = $1)
		ORDER BY u.name ASC
	`
	rows, err := tx.QueryContext(ctx, query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roster []RosterStudentDTO
	for rows.Next() {
		var dto RosterStudentDTO
		var recAt sql.NullTime
		err := rows.Scan(&dto.StudentID, &dto.Name, &dto.Email, &dto.Status, &recAt)
		if err != nil {
			return nil, err
		}
		if recAt.Valid {
			dto.RecordedAt = &recAt.Time
		}
		roster = append(roster, dto)
	}

	return roster, nil
}

// StudentDashboardDTO holds course-wide statistics for a single student.
type StudentDashboardDTO struct {
	StudentID     string  `json:"studentId"`
	Name          string  `json:"name"`
	Email         string  `json:"email"`
	PresentCount  int     `json:"presentCount"`
	TotalSessions int     `json:"totalSessions"`
	AttendancePct float64 `json:"attendancePct"`
}

// GetSectionDashboard compiles list of student averages for a class section.
func (s *Service) GetSectionDashboard(ctx context.Context, collegeID, sectionID, teacherID string) ([]StudentDashboardDTO, error) {
	tx, err := s.dbConn.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return nil, err
	}

	// Ownership authorization check
	var ownerID string
	err = tx.QueryRowContext(ctx, `SELECT teacher_id FROM sections WHERE id = $1`, sectionID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("section not found")
		}
		return nil, err
	}
	if ownerID != teacherID {
		return nil, errors.New("unauthorized: you do not teach this section")
	}

	query := `
		SELECT u.id, u.name, u.email,
		       COALESCE(aa.present_count, 0) as present_count,
		       COALESCE(aa.total_sessions, 0) as total_sessions,
		       COALESCE(aa.attendance_pct, 0.00) as attendance_pct
		FROM enrollments e
		JOIN users u ON u.id = e.student_id
		LEFT JOIN attendance_aggregates aa ON aa.student_id = u.id AND aa.section_id = e.section_id
		WHERE e.section_id = $1
		ORDER BY u.name ASC
	`
	rows, err := tx.QueryContext(ctx, query, sectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []StudentDashboardDTO
	for rows.Next() {
		var dto StudentDashboardDTO
		err := rows.Scan(&dto.StudentID, &dto.Name, &dto.Email, &dto.PresentCount, &dto.TotalSessions, &dto.AttendancePct)
		if err != nil {
			return nil, err
		}
		list = append(list, dto)
	}

	return list, nil
}

// SessionHistoryDTO holds metrics for past class sessions.
type SessionHistoryDTO struct {
	SessionID    string     `json:"sessionId"`
	StartedAt    time.Time  `json:"startedAt"`
	EndedAt      *time.Time `json:"endedAt"`
	PresentCount int        `json:"presentCount"`
	AbsentCount  int        `json:"absentCount"`
}

// GetSectionHistory returns list of all past class sessions and counts for a section.
func (s *Service) GetSectionHistory(ctx context.Context, collegeID, sectionID, teacherID string) ([]SessionHistoryDTO, error) {
	tx, err := s.dbConn.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return nil, err
	}

	// Ownership authorization check
	var ownerID string
	err = tx.QueryRowContext(ctx, `SELECT teacher_id FROM sections WHERE id = $1`, sectionID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("section not found")
		}
		return nil, err
	}
	if ownerID != teacherID {
		return nil, errors.New("unauthorized: you do not teach this section")
	}

	query := `
		SELECT cs.id, cs.started_at, cs.ended_at,
		       COALESCE(SUM(CASE WHEN ar.status IN ('present', 'overridden_present') THEN 1 ELSE 0 END), 0) as present_count,
		       COALESCE(SUM(CASE WHEN ar.status IN ('absent', 'overridden_absent') THEN 1 ELSE 0 END), 0) as absent_count
		FROM class_sessions cs
		LEFT JOIN attendance_records ar ON ar.session_id = cs.id
		WHERE cs.section_id = $1
		GROUP BY cs.id, cs.started_at, cs.ended_at
		ORDER BY cs.started_at DESC
	`
	rows, err := tx.QueryContext(ctx, query, sectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []SessionHistoryDTO
	for rows.Next() {
		var dto SessionHistoryDTO
		var endedAt sql.NullTime
		err := rows.Scan(&dto.SessionID, &dto.StartedAt, &endedAt, &dto.PresentCount, &dto.AbsentCount)
		if err != nil {
			return nil, err
		}
		if endedAt.Valid {
			dto.EndedAt = &endedAt.Time
		}
		history = append(history, dto)
	}

	return history, nil
}
