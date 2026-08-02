package reporting

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"atapp/db"
	"atapp/internal/event"
)

// Updater handles recalculating and saving student attendance aggregates.
type Updater struct {
	dbConn   *sql.DB
	eventBus event.EventBus
}

// NewUpdater instantiates a new aggregates Updater.
func NewUpdater(dbConn *sql.DB, eventBus event.EventBus) *Updater {
	return &Updater{
		dbConn:   dbConn,
		eventBus: eventBus,
	}
}

// UpdateAggregate recalculates present count and attendance percentages under RLS and updates database cache.
func (u *Updater) UpdateAggregate(ctx context.Context, collegeID, studentID, sectionID string) error {
	tx, err := u.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return err
	}

	// 1. Calculate count of ended sessions for this course section
	var totalSessions int
	err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM class_sessions WHERE section_id = $1 AND ended_at IS NOT NULL", sectionID).Scan(&totalSessions)
	if err != nil {
		return fmt.Errorf("failed to count ended sessions: %w", err)
	}

	// 2. Calculate present/overridden present counts for the student in this section
	var presentCount int
	queryPresent := `
		SELECT COUNT(*) 
		FROM attendance_records 
		WHERE student_id = $1 AND session_id IN (
			SELECT id FROM class_sessions WHERE section_id = $2
		) AND status IN ('present', 'overridden_present')
	`
	err = tx.QueryRowContext(ctx, queryPresent, studentID, sectionID).Scan(&presentCount)
	if err != nil {
		return fmt.Errorf("failed to count student present outcomes: %w", err)
	}

	pct := 0.00
	if totalSessions > 0 {
		pct = (float64(presentCount) / float64(totalSessions)) * 100.0
	}

	// 3. Upsert aggregate details
	upsertQuery := `
		INSERT INTO attendance_aggregates (college_id, student_id, section_id, present_count, total_sessions, attendance_pct, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (student_id, section_id)
		DO UPDATE SET 
			present_count = EXCLUDED.present_count,
			total_sessions = EXCLUDED.total_sessions,
			attendance_pct = EXCLUDED.attendance_pct,
			updated_at = NOW()
	`
	_, err = tx.ExecContext(ctx, upsertQuery, collegeID, studentID, sectionID, presentCount, totalSessions, pct)
	if err != nil {
		return fmt.Errorf("failed to upsert aggregates record: %w", err)
	}

	// 4. Check if course threshold is breached
	var thresholdPct sql.NullFloat64
	err = tx.QueryRowContext(ctx, `
		SELECT c.attendance_threshold_pct 
		FROM sections s
		JOIN courses c ON c.id = s.course_id
		WHERE s.id = $1
	`, sectionID).Scan(&thresholdPct)
	if err != nil {
		return fmt.Errorf("failed to lookup course threshold: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// Alert and emit event on threshold breaches
	if thresholdPct.Valid && pct < thresholdPct.Float64 && totalSessions > 0 {
		log.Printf("[ThresholdBreached] Student %s in Section %s is at %.2f%% (Required: %.2f%%)\n", studentID, sectionID, pct, thresholdPct.Float64)
		_ = u.eventBus.Publish(ctx, "threshold.breached", studentID, event.ThresholdBreachedEvent{
			StudentID:    studentID,
			SectionID:    sectionID,
			CollegeID:    collegeID,
			CurrentPct:   pct,
			ThresholdPct: thresholdPct.Float64,
		})
	}

	return nil
}
