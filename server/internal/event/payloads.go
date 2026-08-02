package event

import "time"

// SessionStartedEvent is published when a new class session begins.
type SessionStartedEvent struct {
	SessionID string    `json:"sessionId"`
	SectionID string    `json:"sectionId"`
	CollegeID string    `json:"collegeId"`
	StartedBy string    `json:"startedBy"`
	StartedAt time.Time `json:"startedAt"`
}

// SessionEndedEvent is published when a class session ends.
type SessionEndedEvent struct {
	SessionID string    `json:"sessionId"`
	SectionID string    `json:"sectionId"`
	CollegeID string    `json:"collegeId"`
	EndedAt   time.Time `json:"endedAt"`
}

// AttendanceRecordedEvent is published when a student attendance outcome is recorded.
type AttendanceRecordedEvent struct {
	RecordID   string    `json:"recordId"`
	SessionID  string    `json:"sessionId"`
	StudentID  string    `json:"studentId"`
	CollegeID  string    `json:"collegeId"`
	SectionID  string    `json:"sectionId"`
	Status     string    `json:"status"` // present, absent, overridden_present, overridden_absent
	RecordedAt time.Time `json:"recordedAt"`
}

// ThresholdBreachedEvent is published when a student's attendance percentage falls below a course threshold.
type ThresholdBreachedEvent struct {
	StudentID    string  `json:"studentId"`
	SectionID    string  `json:"sectionId"`
	CollegeID    string  `json:"collegeId"`
	CurrentPct   float64 `json:"currentPct"`
	ThresholdPct float64 `json:"thresholdPct"`
}
