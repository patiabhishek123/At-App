# AtApp — Data Model (v1)

## 1. Design notes

- Every table below includes `college_id` (the tenant key), except lookup/reference tables shared across tenants.
- Postgres row-level security policies filter every query by `college_id`, matched against the requesting user's JWT claims.
- Raw verification signals (BSSID, GPS) are retained for a limited audit window only (see architecture.md §8); older records are pruned to just the pass/fail outcome.

## 2. Core tables

### `colleges`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| created_at | timestamptz | |
| verification_policy | jsonb | default strictness config (e.g., signals required, geofence radius) |

### `departments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| college_id | uuid FK → colleges | |
| name | text | |

### `courses`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| college_id | uuid FK → colleges | |
| department_id | uuid FK → departments | |
| name | text | |
| code | text | e.g. CS301 |
| attendance_threshold_pct | numeric | overrides college default if set |

### `sections`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| course_id | uuid FK → courses | |
| term | text | e.g. "Fall 2026" |
| teacher_id | uuid FK → users | |
| classroom_bssid | text | registered access point for this section's usual room |
| classroom_geofence | point + radius_m | registered location for geofence check |

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| college_id | uuid FK → colleges | |
| role | enum | student, teacher, admin |
| name | text | |
| email | text | |
| password_hash | text | or SSO reference |

### `enrollments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| student_id | uuid FK → users | |
| section_id | uuid FK → sections | |
| enrolled_at | timestamptz | |

### `class_sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| section_id | uuid FK → sections | |
| started_by | uuid FK → users | teacher who started it |
| started_at | timestamptz | |
| ended_at | timestamptz | nullable until session ends |
| current_code | text | latest rotating code value |
| code_updated_at | timestamptz | for TTL checks |
| geofence_override | point + radius_m | nullable; overrides section default if teacher started from elsewhere (e.g. guest lecture room) |

### `verification_attempts`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK → class_sessions | |
| student_id | uuid FK → users | |
| submitted_at | timestamptz | |
| code_match | boolean | |
| bssid_match | boolean | |
| geofence_match | boolean | |
| raw_bssid | text | pruned after audit window |
| raw_gps | point | pruned after audit window |
| result | enum | accepted, rejected |
| rejection_reason | text | nullable |

### `attendance_records`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK → class_sessions | |
| student_id | uuid FK → users | |
| status | enum | present, absent, overridden_present, overridden_absent |
| recorded_at | timestamptz | |
| verification_attempt_id | uuid FK → verification_attempts | nullable if manual override with no submission |

### `overrides`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| attendance_record_id | uuid FK → attendance_records | |
| overridden_by | uuid FK → users | teacher |
| reason | text | required, free text |
| created_at | timestamptz | |

### `attendance_aggregates` (materialized, rebuilt from events)
| Column | Type | Notes |
|---|---|---|
| student_id | uuid FK → users | |
| section_id | uuid FK → sections | |
| present_count | int | |
| total_sessions | int | |
| attendance_pct | numeric | computed |
| updated_at | timestamptz | |

### `notification_log`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| type | enum | threshold_warning, session_reminder |
| sent_at | timestamptz | |
| payload | jsonb | |

## 3. Relationships summary

- A `college` has many `departments`, which have many `courses`, which have many `sections`.
- A `section` has one `teacher` and many `enrollments` (students).
- A `section` produces many `class_sessions` over a term.
- Each `class_session` produces many `verification_attempts` (one per student check-in attempt) and many `attendance_records` (the final outcome per student per session).
- `overrides` link back to a specific `attendance_record` when a teacher manually changes it.
- `attendance_aggregates` is a derived/materialized view, rebuilt from the event stream (`attendance.recorded`) rather than computed on every read — this is what makes the student's real-time percentage cheap to serve.

## 4. Indexing notes

- `verification_attempts(session_id, student_id)` — composite index, since lookups are almost always scoped to "this student's attempt in this session."
- `attendance_records(student_id, section_id)` — for the student's per-course history view.
- `class_sessions(section_id, started_at)` — for teacher's session history screen.
- Partial index on `class_sessions where ended_at is null` — to quickly find any currently-live session per section.
