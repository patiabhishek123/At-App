# AtApp — Tasks & Build Plan (v1)

Organized by phase. Each phase assumes the previous one is functionally complete, though some parallelization is possible (e.g., mobile UI work can start once API contracts are defined, without waiting for full backend implementation).

## Phase 0 — Foundations
- [x] Set up monorepo structure (or separate repos per service — decide based on team size)
- [x] Provision Postgres, Redis, Kafka (Docker Compose for local + pilot)
- [x] Define API contracts (OpenAPI spec) for gateway ↔ client communication
- [x] Set up CI (lint, test, build) for backend services and both frontends
- [x] Implement `college_id`-based Postgres RLS policies and verify with a cross-tenant test

## Phase 1 — Core backend services
- [x] Auth Service: signup/login, JWT issuance + refresh, role-based access control
- [x] Admin Service: college/department/course/section CRUD, enrollment management, CSV bulk import
- [x] Session Service: start/end session, rotating code generation (Redis-backed TTL), BSSID/geofence registration
- [x] Verification Service: evaluate code/BSSID/geofence match on submission
- [x] Attendance Service: record outcomes, handle manual overrides, emit Kafka events
- [x] Kafka topics set up: `session.started`, `checkin.submitted`, `checkin.verified`, `attendance.recorded`, `threshold.breached`
- [x] Notification Service: consume events, send push notifications (integrate with FCM/APNs)
- [x] Reporting Service: consume `attendance.recorded`, maintain `attendance_aggregates`

## Phase 2 — Teacher mobile app (Flutter)
- [x] Auth screens (login, session persistence)
- [x] Today's schedule screen
- [x] Start session flow (course/section picker → live code screen)
- [x] Live roster view with real-time updates (WebSocket or polling)
- [x] Manual override flow with required reason field
- [x] Course dashboard (attendance trend, below-threshold list, CSV export)
- [x] Session history screen


## Phase 3 — Student mobile app (Flutter)
- [x] Auth screens
- [x] Home screen with per-course attendance % and live-session banner
- [x] Check-in flow: QR scan / manual code entry, background BSSID + GPS capture, submit
- [x] Failure-reason display with retry
- [x] Course detail screen with attendance history chart
- [x] Push notification handling (threshold warnings, session reminders)


## Phase 4 — Admin website (Next.js)
- [x] Auth + role-gated routing
- [x] Institution dashboard (filterable attendance overview)
- [x] Course/section management UI
- [x] Bulk CSV import UI with validation feedback
- [x] Audit log viewer (overrides, verification-failure patterns)
- [x] Tenant settings (verification strictness, term dates)

## Phase 5 — Verification hardening & edge cases
- [x] Rate-limiting on check-in submissions per student per session
- [x] Configurable "N of 3 signals required" per college
- [x] Handling shared/misconfigured access points (admin recalibration flow)
- [x] Audit-window pruning job for raw BSSID/GPS data (retain outcome only after window)
- [x] Load-test the check-in path for a full classroom submitting near-simultaneously

## Phase 6 — Pilot & launch
- [x] Onboard one pilot college: departments, courses, sections, teachers, students
- [x] Calibrate classroom BSSIDs and geofences on-site
- [x] Run a shadow period (paper + app in parallel) to validate accuracy before cutover
- [x] Collect teacher/student feedback on friction points
- [x] Fix top issues, then cut over fully for the pilot college
- [x] Prepare onboarding runbook for the next college

