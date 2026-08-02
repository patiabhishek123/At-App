package verification

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"

	"atapp/db"
	"atapp/internal/event"
	"github.com/redis/go-redis/v9"
)

// Service verifies check-ins against active rotating codes and geofences.
type Service struct {
	dbConn   *sql.DB
	rdb      *redis.Client
	eventBus event.EventBus
}

// NewService instantiates a new Verification Service.
func NewService(dbConn *sql.DB, rdb *redis.Client, eventBus event.EventBus) *Service {
	return &Service{
		dbConn:   dbConn,
		rdb:      rdb,
		eventBus: eventBus,
	}
}

// CheckinResult holds the status of a checkin validation attempt.
type CheckinResult struct {
	Result          string  `json:"result"`
	RejectionReason *string `json:"rejectionReason"`
}

// distance calculates the distance between two points in meters using the Haversine formula.
func distance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000.0 // Earth radius in meters
	phi1 := lat1 * math.Pi / 180.0
	phi2 := lat2 * math.Pi / 180.0
	deltaPhi := (lat2 - lat1) * math.Pi / 180.0
	deltaLambda := (lon2 - lon1) * math.Pi / 180.0

	a := math.Sin(deltaPhi/2)*math.Sin(deltaPhi/2) +
		math.Cos(phi1)*math.Cos(phi2)*
			math.Sin(deltaLambda/2)*math.Sin(deltaLambda/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}

// SubmitCheckin checks student credentials, Wi-Fi BSSID, and GPS locations.
func (s *Service) SubmitCheckin(ctx context.Context, collegeID, studentID string, code, submittedBssid string, lat, lng float64) (CheckinResult, error) {
	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return CheckinResult{}, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return CheckinResult{}, err
	}

	// Fetch College Verification Policy
	var policyRaw []byte
	err = tx.QueryRowContext(ctx, "SELECT verification_policy FROM colleges WHERE id = $1", collegeID).Scan(&policyRaw)
	if err != nil {
		return CheckinResult{}, fmt.Errorf("failed to load college verification policy: %w", err)
	}

	var policy struct {
		NRequired   int `json:"n_required"`
		MaxAttempts int `json:"max_attempts"`
	}
	policy.NRequired = 3   // Default: All 3 signals required
	policy.MaxAttempts = 3 // Default: 3 attempts limit
	if len(policyRaw) > 0 && string(policyRaw) != "{}" {
		_ = json.Unmarshal(policyRaw, &policy)
	}
	if policy.NRequired <= 0 {
		policy.NRequired = 3
	}
	if policy.MaxAttempts <= 0 {
		policy.MaxAttempts = 3
	}

	// 1. Resolve active session from student's enrollments
	query := `
		SELECT 
			cs.id, cs.section_id, 
			cs.geofence_override_lat, cs.geofence_override_lng, cs.geofence_override_radius_m,
			s.classroom_bssid, s.classroom_geofence_lat, s.classroom_geofence_lng, s.classroom_geofence_radius_m
		FROM class_sessions cs
		JOIN enrollments e ON e.section_id = cs.section_id
		JOIN sections s ON s.id = cs.section_id
		WHERE e.student_id = $1 AND cs.ended_at IS NULL
		LIMIT 1
	`
	var sessionID, sectionID string
	var overrideLat, overrideLng, overrideRadius *float64
	var defaultBssid *string
	var defaultLat, defaultLng, defaultRadius *float64

	err = tx.QueryRowContext(ctx, query, studentID).Scan(
		&sessionID, &sectionID,
		&overrideLat, &overrideLng, &overrideRadius,
		&defaultBssid, &defaultLat, &defaultLng, &defaultRadius,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CheckinResult{}, errors.New("no active class session found for your enrolled courses")
		}
		return CheckinResult{}, fmt.Errorf("failed to lookup active session: %w", err)
	}

	// Rate-limiting check
	rateKey := fmt.Sprintf("rate:student:%s:session:%s", studentID, sessionID)
	attemptsStr, err := s.rdb.Get(ctx, rateKey).Result()
	if err == nil {
		attempts, _ := strconv.Atoi(attemptsStr)
		if attempts >= policy.MaxAttempts {
			reason := "rate limit exceeded: too many failed check-in attempts for this session"
			return CheckinResult{
				Result:          "rejected",
				RejectionReason: &reason,
			}, nil
		}
	}

	// Check if already checked in
	var alreadyCheckedIn bool
	err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM attendance_records WHERE session_id = $1 AND student_id = $2 AND status = 'present')", sessionID, studentID).Scan(&alreadyCheckedIn)
	if err == nil && alreadyCheckedIn {
		reason := "already checked in for this session"
		return CheckinResult{
			Result:          "rejected",
			RejectionReason: &reason,
		}, nil
	}

	// 2. Validate Code
	codeKey := fmt.Sprintf("session:%s:code", sessionID)
	prevKey := fmt.Sprintf("session:%s:prev", sessionID)

	activeCode, _ := s.rdb.Get(ctx, codeKey).Result()
	prevCode, _ := s.rdb.Get(ctx, prevKey).Result()

	codeMatch := (code == activeCode && activeCode != "") || (code == prevCode && prevCode != "")

	// 3. Validate Wi-Fi BSSID
	bssidMatch := true
	if defaultBssid != nil && *defaultBssid != "" {
		bssidMatch = (submittedBssid == *defaultBssid)
	}

	// 4. Validate GPS geofence (with support for session-level teacher overrides)
	geofenceMatch := true
	targetLat := defaultLat
	targetLng := defaultLng
	targetRadius := defaultRadius

	if overrideLat != nil && overrideLng != nil && overrideRadius != nil {
		targetLat = overrideLat
		targetLng = overrideLng
		targetRadius = overrideRadius
	}

	if targetLat != nil && targetLng != nil && targetRadius != nil {
		dist := distance(lat, lng, *targetLat, *targetLng)
		geofenceMatch = (dist <= *targetRadius)
	}

	// Compile results based on verification policy requirement count N
	matchedCount := 0
	if codeMatch {
		matchedCount++
	}
	if bssidMatch {
		matchedCount++
	}
	if geofenceMatch {
		matchedCount++
	}

	result := "accepted"
	var rejectionReason string

	if matchedCount < policy.NRequired {
		result = "rejected"
		if !codeMatch {
			rejectionReason = "invalid or expired class code"
		} else if !bssidMatch {
			rejectionReason = "not connected to the classroom Wi-Fi network"
		} else if !geofenceMatch {
			rejectionReason = "outside the classroom geofence boundary"
		} else {
			rejectionReason = "insufficient validation signals"
		}
	}

	// 5. Log attempt
	var attemptID string
	insertAttempt := `
		INSERT INTO verification_attempts (
			college_id, session_id, student_id, code_match, bssid_match, geofence_match, 
			raw_bssid, raw_gps_lat, raw_gps_lng, result, rejection_reason
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id
	`
	var rejReasonNull sql.NullString
	if result == "rejected" {
		rejReasonNull = sql.NullString{String: rejectionReason, Valid: true}
	}

	err = tx.QueryRowContext(ctx, insertAttempt,
		collegeID, sessionID, studentID, codeMatch, bssidMatch, geofenceMatch,
		submittedBssid, lat, lng, result, rejReasonNull,
	).Scan(&attemptID)
	if err != nil {
		return CheckinResult{}, fmt.Errorf("failed to save checkin verification attempt: %w", err)
	}

	var recordID string
	recordedTime := time.Now()

	// 6. Record present status if accepted
	if result == "accepted" {
		insertRecord := `
			INSERT INTO attendance_records (college_id, session_id, student_id, status, verification_attempt_id)
			VALUES ($1, $2, $3, 'present', $4)
			ON CONFLICT (session_id, student_id) 
			DO UPDATE SET status = 'present', verification_attempt_id = EXCLUDED.verification_attempt_id, recorded_at = NOW()
			RETURNING id
		`
		err = tx.QueryRowContext(ctx, insertRecord, collegeID, sessionID, studentID, attemptID).Scan(&recordID)
		if err != nil {
			return CheckinResult{}, fmt.Errorf("failed to write attendance record: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return CheckinResult{}, err
	}

	// Update Rate Limiting Key status in Redis
	if result == "accepted" {
		s.rdb.Del(ctx, rateKey)
	} else {
		s.rdb.Incr(ctx, rateKey)
		s.rdb.Expire(ctx, rateKey, 15*time.Minute)
	}

	// 7. Publish event
	if result == "accepted" {
		_ = s.eventBus.Publish(ctx, "attendance.recorded", recordID, event.AttendanceRecordedEvent{
			RecordID:   recordID,
			SessionID:  sessionID,
			StudentID:  studentID,
			CollegeID:  collegeID,
			SectionID:  sectionID,
			Status:     "present",
			RecordedAt: recordedTime,
		})
	}

	if result == "rejected" {
		return CheckinResult{
			Result:          result,
			RejectionReason: &rejectionReason,
		}, nil
	}

	return CheckinResult{
		Result: result,
	}, nil
}

// PruneRawVerificationData zeroes out raw BSSID and GPS fields older than the retention window.
func (s *Service) PruneRawVerificationData(ctx context.Context, retentionWindow time.Duration) (int64, error) {
	cutoff := time.Now().Add(-retentionWindow)
	query := `
		UPDATE verification_attempts
		SET raw_bssid = NULL, raw_gps_lat = NULL, raw_gps_lng = NULL
		WHERE submitted_at < $1 AND (raw_bssid IS NOT NULL OR raw_gps_lat IS NOT NULL OR raw_gps_lng IS NOT NULL)
	`
	res, err := s.dbConn.ExecContext(ctx, query, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to prune raw verification data: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	return rows, nil
}

