# AtApp — Architecture (v1)

## 1. Principles

- **Multi-tenant from day one.** Every table and every request carries a `college_id`. Retrofitting this later is far more expensive than building it in now, even though v1 only launches with one or two pilot colleges.
- **Services split by bounded context, not by class.** Each service owns its own data and responsibilities; they don't share tables. This is what makes the "microservices" label earn its keep rather than being a monolith cut into pieces that all read the same database.
- **Layered verification, no single point of trust.** No one signal (WiFi, GPS, code) is authoritative on its own — the attendance service evaluates all of them together.
- **Events for anything asynchronous**, requests for anything synchronous. A student checking in is a synchronous request (they need an immediate result). A threshold breach triggering a notification is asynchronous — it shouldn't block the check-in path.

## 2. System overview

Clients (teacher app, student app, admin website) talk to a single **API gateway**, which handles authentication and routes requests to the appropriate backend service. Services communicate with each other either via direct request (when a synchronous answer is needed) or via a Kafka event stream (when the result can be handled asynchronously).

```
Teacher app ─┐
             ├──> API Gateway (auth, routing, rate limiting) ──> Session Service
Student app ─┘                                              ──> Verification Service
                                                              ──> Attendance Service
Admin website ──────────────────────────────────────────────> Reporting Service
                                                              ──> Admin Service

Kafka event bus: session.started, checkin.submitted, checkin.verified,
                 attendance.recorded, threshold.breached
                 (consumed by: Notification Service, Reporting Service)
```

## 3. Services

| Service | Responsibility | Data owned |
|---|---|---|
| **Auth Service** | Login, JWT issuance/refresh, role management (student/teacher/admin), college-scoped tenancy | `users`, `roles`, `sessions_tokens` |
| **Session Service** | Teacher starts/ends a class session; generates and rotates the check-in code; registers session geofence + BSSID | `class_sessions` |
| **Verification Service** | Evaluates a student's check-in submission against the session's code, BSSID, and geofence; returns pass/fail per signal | reads `class_sessions`, writes `verification_attempts` |
| **Attendance Service** | Records the final attendance outcome; computes running attendance percentages; handles manual overrides | `attendance_records`, `overrides` |
| **Notification Service** | Consumes Kafka events; sends push notifications (threshold warnings, session reminders) | `notification_log` |
| **Reporting Service** | Aggregates data for dashboards and CSV exports; consumes events to keep aggregates near-real-time rather than computing on read | `attendance_aggregates` (materialized, rebuilt from source events) |
| **Admin Service** | College/tenant onboarding, course/section/enrollment management, bulk CSV import | `colleges`, `departments`, `courses`, `sections`, `enrollments` |

For v1, these can be deployed as separate services in the same repo (a "modular monolith" deploy target) if a full microservices rollout is premature for your team size — the important part is that the *code* is already split by bounded context with no cross-service table access, so promoting any one of them to its own deployment later is a config change, not a rewrite.

## 4. Communication patterns

- **Synchronous (REST/gRPC)**: client → gateway → service, and service → service where an immediate answer is required (e.g., Verification Service calling Session Service to fetch the current valid code).
- **Asynchronous (Kafka)**: anything that doesn't block the user-facing request. Example: `checkin.verified` event triggers the Attendance Service to persist the record and emit `attendance.recorded`, which the Reporting Service consumes to update dashboards and the Notification Service consumes to check threshold breaches.
- This separation matters specifically for the check-in path: a student's "present" confirmation should return in under a second, without waiting on notification delivery or dashboard aggregation.

## 5. Multi-tenancy

- Every table includes `college_id`.
- Postgres row-level security (RLS) policies enforce that a query can only see rows matching the requesting service/user's `college_id` — enforced at the database layer, not just application logic, so a bug in one service can't leak cross-tenant data.
- The API gateway resolves `college_id` from the authenticated user's JWT claims on every request.

## 6. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile apps (teacher, student) | Flutter | Consistent native module access for WiFi BSSID, geolocation, and background checks across iOS/Android |
| Admin website | Next.js (React + TypeScript) | Matches your existing TypeScript background; strong for dashboard-style CRUD UI |
| Backend services | Go | Matches your background; strong concurrency primitives suit the check-in verification path |
| Primary datastore | PostgreSQL | Relational integrity for enrollments/sessions/records; RLS support for tenancy |
| Cache / short-lived state | Redis | Natural fit for rotating-code TTLs and session state |
| Event bus | Kafka | Matches your background; decouples the notification/reporting paths from the check-in path |
| Auth | JWT (short-lived access + refresh tokens) | Standard, stateless, works well with the gateway pattern |
| Container orchestration | Docker Compose (v1) → Kubernetes (post-pilot) | Avoid k8s overhead before you have real multi-service scale pressure |

## 7. Deployment (v1)

- Docker Compose for local dev and the pilot deployment: one container per service, one Postgres instance (multiple schemas or a shared instance with RLS), one Redis, one Kafka broker (single-node, e.g., via Redpanda for simplicity during pilot).
- CI: run tests + build images on push; manual deploy trigger for the pilot college during v1 (no need for full CD pipeline yet).
- Move to Kubernetes once you're onboarding multiple colleges concurrently and need per-service autoscaling.

## 8. Security considerations

- Location and WiFi data are sensitive — encrypt at rest, and only retain raw verification signals (BSSID, GPS coordinates) for a limited audit window (e.g., 90 days), after which only the pass/fail outcome is kept.
- Rate-limit check-in submissions per student per session to prevent brute-forcing the rotating code.
- Audit-log every manual override with teacher ID, student ID, reason, and timestamp — this is your primary defense against the system itself becoming a proxy-attendance loophole.
