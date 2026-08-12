# AtApp Project Completion & Verification Checklist

Last reviewed: 2026-08-12

This document is the working definition of "done" for AtApp. A task should only be
checked after its implementation, automated checks, and manual acceptance criteria
all pass.

## Status legend

- `[ ]` Not started or not verified
- `[~]` In progress
- `[x]` Implemented and verified
- **P0** Release/security blocker
- **P1** Required for a usable pilot
- **P2** Quality, maintainability, or post-pilot work

## Current baseline

| Area | Current state | Verification baseline |
|---|---|---|
| Go backend | Core services and integration tests exist | `./scripts/verify.sh server` passes with serialized integration packages |
| Student Flutter app | Login, courses, manual code check-in, GPS/BSSID submission implemented | `flutter analyze` and 2 login widget tests pass |
| Teacher Flutter app | Sections, sessions, rotating code, roster, overrides, dashboard and history implemented | `flutter analyze` and 2 login widget tests pass |
| Admin website | Polished interactive prototype | Uses hard-coded/local React state and is not connected to the Go API |
| Admin lint/build | Clean | `npm run lint` and `npm run build` pass |
| Notifications | Kafka consumers exist | Delivery uses console logging; no FCM/APNs delivery or notification persistence |
| Documentation | Product intent is well documented | README, tasks, OpenAPI, and implementation disagree in several places |

## Definition of done for a pilot

The pilot is ready only when:

- All P0 tasks are complete.
- All P1 tasks are complete or explicitly accepted as deferred by the project owner.
- Backend, student app, teacher app, and admin web automated checks pass.
- A clean database can be initialized without destructive production migration behavior.
- The end-to-end acceptance scenario near the end of this document passes.
- No demo coordinates, BSSIDs, credentials, or authentication bypasses are active in a release build.

---

## Ordered execution plan

Work through these milestones in order. Do not begin the next milestone until the
current milestone's verification gate passes, unless the blocker and reason are
recorded in this document.

### Milestone 0: Establish trustworthy quality gates

Tasks: `TEST-01`, current admin lint failures from `TEST-03`, and a repeatable local
test command for each component.

Status: **Complete — 2026-08-12**

Deliverables:

- [x] Replace both stale Flutter counter tests.
- [x] Make Flutter analysis/tests runnable and establish the actual baseline.
- [x] Fix existing Next.js lint errors.
- [x] Run the existing Go suite with a writable dedicated build cache.
- [x] Add a small root verification script or documented command sequence.

Gate:

- [x] Existing behavior has passing baseline checks before security behavior changes.

Planned commits:

1. `test(mobile): replace stale Flutter widget smoke tests`
2. `fix(admin): resolve existing lint failures`
3. `chore(ci): add repeatable project verification commands`

### Milestone 1: Close authentication and authorization blockers

Tasks: `SEC-01`, `SEC-02`, `SEC-03`, and authorization portions of `SEC-05`.

Deliverables:

- Restrict signup and privileged account creation.
- Add access/refresh token purposes and enforce them.
- Enforce teacher ownership for code retrieval and session ending.
- Add focused negative authorization tests.

Gate:

- Unauthenticated privilege creation, refresh-token API access, same-tenant teacher
  access, and cross-tenant access are all rejected by automated tests.

Planned commits:

1. `fix(auth): restrict tenant account creation`
2. `fix(auth): enforce access and refresh token purposes`
3. `fix(session): enforce teacher ownership for session operations`

### Milestone 2: Guarantee attendance correctness

Tasks: `ATT-01`, `ATT-02`, `ATT-03`, and attendance portions of `SEC-05`.

Deliverables:

- Remove production fallback signals and reject unavailable required signals.
- Identify the intended session deterministically during check-in.
- Make code rotation concurrency-safe and recovery-aware.
- Validate enrollment, coordinates, policy values, and override targets.

Gate:

- Missing signals cannot pass, simultaneous sessions resolve correctly, and
  concurrent rotation tests expose only one valid current code.

Planned commits:

1. `fix(verification): reject missing required presence signals`
2. `fix(checkin): resolve active sessions deterministically`
3. `fix(session): make rotating codes concurrency-safe`
4. `fix(attendance): validate enrollment and override targets`

### Milestone 3: Harden persistence and asynchronous consistency

Tasks: `DB-01`, `DB-02`, `DB-03`, `ATT-04`, and `ATT-05`.

Deliverables:

- Split destructive development reset behavior from forward-only migrations.
- Separate migration and RLS-restricted runtime credentials.
- Add constraints and correct indexes.
- Introduce reliable event delivery, idempotent processing, and aggregate rebuild.

Gate:

- Migrations preserve seeded data, RLS isolation passes for every table, and Kafka
  outage/replay tests leave aggregates consistent with source attendance records.

Planned commits:

1. `refactor(db): introduce forward-only migrations and dev reset`
2. `fix(db): enforce runtime RLS role and data constraints`
3. `feat(events): add reliable attendance event delivery`
4. `feat(reporting): support idempotent aggregate reconciliation`

### Milestone 4: Stabilize mobile clients

Tasks: `APP-01`, `APP-02`, `APP-03`, and the remaining mobile portion of `TEST-01`.

Deliverables:

- Correct persisted JWT restoration and refresh behavior in both apps.
- Refresh student course data after check-in and use real history data.
- Complete permission/error states and remove demo signal behavior.
- Restore teacher sessions safely and manage polling lifecycle correctly.
- Decide and implement or remove QR, scheduling, notification inbox, and mobile CSV
  claims from v1.

Gate:

- Both apps pass analyze/tests and the documented mobile acceptance flows on an
  emulator or device against the staging backend.

Planned commits:

1. `fix(mobile-auth): restore and refresh sessions safely`
2. `feat(student): complete verified check-in and attendance history flow`
3. `feat(teacher): recover live sessions and harden polling lifecycle`
4. `test(mobile): cover student and teacher critical flows`

### Milestone 5: Turn the admin prototype into a real client

Tasks: `APP-04` and the remaining admin portion of `TEST-03`.

Deliverables:

- Add required backend read/update/delete, audit, reporting, and settings APIs.
- Replace preview authentication and hard-coded state with API-backed data.
- Connect CRUD, CSV imports, filters, audit log, settings, and exports.
- Add component and browser-level tests.

Gate:

- Data survives browser refresh, all actions are tenant-scoped, and lint/build/UI
  tests pass without hard-coded production records or authentication bypasses.

Planned commits:

1. `feat(admin-api): add tenant management and reporting endpoints`
2. `feat(admin-web): connect authentication and dashboard data`
3. `feat(admin-web): connect CRUD imports audit and settings`
4. `test(admin-web): cover tenant administration workflows`

### Milestone 6: Deliver real notifications

Tasks: `NOT-01` and `NOT-02`.

Deliverables:

- Add device-token registration and lifecycle management.
- Implement FCM/APNs delivery through the notifier interface.
- Persist notification attempts/results and add retry/deduplication.
- Notify only on threshold crossings.

Gate:

- Test devices receive exactly one expected session/threshold notification, and
  delivery failures are persisted and retried safely.

Planned commits:

1. `feat(notifications): add device registration and persistent delivery log`
2. `feat(notifications): deliver push messages with retry and deduplication`
3. `fix(reporting): emit notifications only on threshold crossing`

### Milestone 7: Align contracts, documentation, and CI

Tasks: `TEST-02`, `TEST-04`, `DOC-01`, `DOC-02`, and `DOC-03`.

Deliverables:

- Complete backend coverage and unified CI.
- Make OpenAPI describe every route and error contract.
- Reconcile README/roadmap claims with verified functionality.
- Add environment, migration, recovery, and privacy documentation.
- Remove or relocate unrelated artifacts.

Gate:

- A clean checkout follows documented setup successfully and every required CI job
  passes; every completed roadmap claim has a verification reference.

Planned commits:

1. `test(server): cover authorization reporting and concurrency`
2. `docs(api): synchronize OpenAPI with implemented routes`
3. `docs: align roadmap setup privacy and operations guidance`
4. `ci: enforce full-stack verification gates`

### Milestone 8: Prove pilot readiness

Tasks: `OPS-01`, `OPS-02`, `OPS-03`, followed by the end-to-end pilot acceptance
scenario. `OPS-04` remains post-pilot unless separately approved.

Deliverables:

- Add health checks, structured telemetry, operational metrics, and alerts.
- Validate retention, access, backup, restore, and aggregate recovery procedures.
- Run agreed load and dependency-failure tests.
- Execute and sign off the complete two-college acceptance scenario.

Gate:

- Every P0/P1 checklist item is complete or has a signed deferral, and the release
  sign-off table is completed.

Planned commits:

1. `feat(ops): add health telemetry and operational alerts`
2. `test(ops): add resilience retention and load verification`
3. `docs(pilot): record acceptance results and release sign-off`

## Git and GitHub workflow

- Work on `codex/project-hardening`; keep `main` deployable.
- Before each commit, inspect `git diff` and include only files belonging to that
  milestone. Never absorb unrelated user changes.
- Use one focused commit per independently reviewable behavior change. The planned
  messages above are guides and may be refined to describe the actual diff.
- Run the relevant component gate before every commit and record any environmental
  limitation in the commit handoff.
- Push verified milestone commits to `origin/codex/project-hardening` so work is
  backed up and visible on GitHub.
- Do not force-push, rewrite published history, or commit secrets/generated build
  output.
- At each milestone boundary, update this checklist in the same milestone's final
  commit, then open/update a pull request with test evidence and remaining risks.
- Merge only after the milestone gate passes. Prefer squash-free merges when the
  focused commits provide useful review history.

Recommended pull-request grouping:

1. Baseline quality gates (Milestone 0).
2. Security and attendance correctness (Milestones 1–2).
3. Persistence and event reliability (Milestone 3).
4. Mobile completion (Milestone 4).
5. Admin integration (Milestone 5).
6. Notifications (Milestone 6).
7. Contracts, CI, and operations (Milestones 7–8).

---

## 1. Security and authorization — P0

### SEC-01: Restrict account creation

- [x] Remove public self-selection of `collegeId` and privileged roles from `/auth/signup`.
- [ ] Make tenant onboarding and admin creation a protected bootstrap/admin workflow.
- [x] Permit normal user creation only through an authenticated college admin or controlled invitation/import.

Verification:

- An unauthenticated caller cannot create a teacher or admin account.
- A college admin cannot create a user in another college.
- Add tests for unauthorized signup, cross-tenant creation, and permitted admin creation.

### SEC-02: Distinguish access and refresh tokens

- [x] Add a signed token-purpose claim such as `token_type: access|refresh`.
- [x] Accept only access tokens in gateway middleware.
- [x] Accept only refresh tokens at `/auth/refresh`.
- [ ] Add refresh-token rotation/revocation or document the accepted pilot policy.

Verification:

- A refresh token receives `401` when used on `/student/*`, `/teacher/*`, or `/admin/*`.
- An access token receives `401` at `/auth/refresh`.
- Expired and tampered tokens are rejected by automated tests.

### SEC-03: Enforce teacher ownership for every session operation

- [ ] Require that the authenticated teacher owns the section before retrieving a code.
- [ ] Require ownership before ending a session.
- [ ] Retain ownership checks for roster, dashboard, history, and overrides.

Verification:

- Teacher A cannot read, end, or override Teacher B's session in the same college.
- Cross-college access remains blocked by PostgreSQL RLS.

### SEC-04: Remove release-time secrets and permissive networking

- [ ] Refuse to start outside development mode when the default JWT secret is present.
- [ ] Move database credentials and other secrets to environment/secret management.
- [ ] Replace wildcard CORS with configured trusted origins.
- [ ] Use HTTPS for deployed API traffic.
- [ ] Configure environment-specific API base URLs in both Flutter apps.

Verification:

- A release deployment with default secrets fails fast with a clear message.
- Requests from an unapproved browser origin are rejected.
- No production credential is committed to the repository.

### SEC-05: Validate sensitive input and authorization targets

- [ ] Validate UUIDs, email formats, passwords, roles, thresholds, radii, latitude, and longitude.
- [ ] Verify an overridden student is enrolled in the target session's section.
- [ ] Enforce nonblank and length-limited override reasons.
- [ ] Return appropriate `400`, `403`, `404`, and `409` responses instead of generic `500` errors.

Verification:

- Invalid and cross-section inputs are rejected without changing database state.
- Boundary-value and authorization tests cover every write endpoint.

---

## 2. Attendance correctness and data integrity — P0

### ATT-01: Never treat missing verification signals as passing

- [ ] Change missing BSSID or geofence configuration from implicit `true` to an explicit policy outcome.
- [ ] Reject missing device readings when the corresponding signal is required.
- [ ] Show a clear permission/configuration error to the student.
- [ ] Remove hard-coded fallback BSSID and GPS coordinates from release builds.

Verification:

- Denying location permission cannot produce an accepted GPS match.
- A device without BSSID access cannot produce an accepted BSSID match.
- Demo fallback values are available only behind an explicit development flag, if retained at all.

### ATT-02: Resolve the intended session deterministically

- [ ] Include a session identifier in the student check-in flow, or resolve the submitted code safely across active enrolled sessions.
- [ ] Remove nondeterministic `LIMIT 1` behavior.
- [ ] Define behavior when a student has two simultaneous enrolled sessions.

Verification:

- With two live enrolled sections, a code marks attendance only in its matching session.
- Invalid codes do not create records in either session.

### ATT-03: Make code rotation concurrency-safe

- [ ] Prevent concurrent polling requests from generating multiple competing codes.
- [ ] Make Redis and PostgreSQL code state recover consistently after partial failure.
- [ ] Document and test the previous-code grace window.

Verification:

- Concurrent code requests expose one current code.
- Current and permitted previous codes work only inside their intended windows.
- Restart/recovery tests do not leave a permanently unusable active session.

### ATT-04: Make event publication reliable

- [ ] Stop silently ignoring Kafka publication errors.
- [ ] Implement an outbox/retry strategy or another documented delivery guarantee.
- [ ] Make reporting updates idempotent.
- [ ] Add reconciliation to rebuild aggregates from attendance records.

Verification:

- A temporary Kafka outage does not permanently lose aggregate updates.
- Replaying an event does not corrupt counts.
- Rebuilt aggregates match source attendance records.

### ATT-05: Correct session closure and aggregate timing

- [ ] Confirm aggregate totals update for every present, absent, and overridden record.
- [ ] Confirm ending a session publishes/reconciles all newly absent records.
- [ ] Decide how active sessions affect displayed percentages and document it.

Verification:

- A controlled roster produces the exact expected present count, total sessions, and percentage after session end.
- Overrides immediately produce the expected aggregate after asynchronous processing.

---

## 3. Database and multi-tenancy — P0/P1

### DB-01: Replace the destructive initialization migration — P0

- [ ] Remove `DROP TABLE IF EXISTS` statements from deployable migrations.
- [ ] Introduce ordered, forward-only migrations and a separate development reset/seed script.
- [ ] Document backup and rollback procedures.

Verification:

- Applying migrations to a populated database preserves existing data.
- A new empty database can be built from migrations alone.

### DB-02: Verify the runtime database role — P0

- [ ] Ensure the application uses a non-superuser, non-owner role subject to forced RLS.
- [ ] Separate migration credentials from runtime credentials.
- [ ] Test every tenant-owned table for read and write isolation.

Verification:

- Tenant A cannot select, update, insert, or delete Tenant B data through the runtime connection.
- Requests without tenant context see no tenant rows.

### DB-03: Add missing constraints and indexes — P1

- [ ] Add tenant-appropriate uniqueness for course codes and department names if required.
- [ ] Ensure foreign references cannot accidentally join objects from different colleges.
- [ ] Review the attendance index documented as `(student_id, section_id)` because `attendance_records` has no `section_id` column.
- [ ] Add constraints for percentage/radius ranges and valid verification-policy JSON.

Verification:

- Invalid cross-tenant relationships and out-of-range values fail at the database layer.
- `EXPLAIN ANALYZE` confirms acceptable plans for roster, student courses, dashboard, and history queries.

---

## 4. Complete the client applications — P1

### APP-01: Repair persisted mobile authentication

- [ ] Align Flutter claim decoding with backend claims (`user_id`, `college_id`).
- [ ] Do not expect `name` and `email` in the JWT unless the backend deliberately adds them.
- [ ] Validate token expiry at startup and refresh or log out cleanly.
- [ ] Prevent parallel requests from racing multiple refresh operations.

Verification:

- Login, app restart, access-token expiry, refresh, logout, and revoked/invalid token scenarios work in both apps.

### APP-02: Finish the student experience

- [ ] Refresh course percentages immediately after a successful check-in.
- [ ] Replace the synthesized trend chart with real attendance-history data, or label/remove it.
- [ ] Implement QR scanning only if it remains a product requirement; otherwise correct the documentation.
- [ ] Add a notification inbox or remove it from the v1 specification.
- [ ] Configure Android and iOS location/Wi-Fi permissions and explain denied-permission states.

Verification:

- A successful check-in updates the correct course without restarting the app.
- Course history matches backend records exactly.
- Permission-denied and unavailable-signal states are understandable and cannot fake presence.

### APP-03: Finish the teacher experience

- [ ] Rename "Today's Schedule" or add an actual scheduling model/filter.
- [ ] Restore/recover an active session after app restart.
- [ ] Disable duplicate session starts and prevent timer leaks.
- [ ] Verify dashboard export if it remains a requirement.
- [ ] Clearly display session-end summaries and asynchronous update state.

Verification:

- A teacher can start, leave, reopen, and end the same session safely.
- No background polling continues after logout, navigation away, or session end.

### APP-04: Connect the admin portal to the backend

- [ ] Default to logged out and replace hard-coded credentials with real admin JWT authentication.
- [ ] Load real departments, courses, sections, users, aggregates, and audit data.
- [ ] Persist create/edit/delete operations through authorized API endpoints.
- [ ] Send CSV imports to backend multipart endpoints and show row-level errors.
- [ ] Persist verification policy and academic-term settings.
- [ ] Add missing backend read/update/delete, audit, reporting, and settings endpoints.

Verification:

- Refreshing the browser preserves all saved changes because they came from the database.
- An admin from one college cannot view or edit another college's data.
- There are no hard-coded production dashboard records or credential bypasses.

---

## 5. Notifications and background processing — P1

### NOT-01: Implement real notification delivery

- [ ] Store device tokens securely and support token replacement/removal.
- [ ] Implement FCM/APNs delivery behind the existing notifier interface.
- [ ] Persist attempts and outcomes in `notification_log`.
- [ ] Add retry, deduplication, and failure monitoring.

Verification:

- A session-start event reaches enrolled test devices once.
- A threshold breach reaches only the affected student.
- Failed delivery is logged and retried according to policy.

### NOT-02: Avoid repeated threshold alerts

- [ ] Emit an alert only when crossing the threshold, not on every later attendance event below it.
- [ ] Define reset behavior after recovery above the threshold.

Verification:

- Repeated below-threshold updates do not spam the student.
- Dropping below again after recovery creates a new alert.

---

## 6. Automated tests and quality gates — P0/P1

### TEST-01: Replace stale Flutter tests — P0

- [x] Remove both default counter tests that reference nonexistent `MyApp`.
- [ ] Add student authentication, home, check-in success/failure, and course-detail widget tests.
- [ ] Add teacher authentication, section list, live session, roster, override, and session-end widget tests.
- [ ] Mock secure storage, HTTP, location, and network plugins.

Verification commands:

```bash
cd student_app && flutter analyze && flutter test
cd teacher_app && flutter analyze && flutter test
```

Expected result: both commands exit successfully with no analyzer errors.

### TEST-02: Expand backend coverage — P1

- [ ] Add tests for attendance queries and overrides.
- [ ] Add gateway authorization/role tests.
- [ ] Add reporting idempotency and notification-consumer tests.
- [ ] Add concurrent code-rotation and simultaneous-session tests.
- [ ] Ensure integration tests create isolated data and do not destructively reset shared databases.

Verification command:

```bash
cd server && go test -race -count=1 ./...
```

Expected result: command exits successfully with no races.

### TEST-03: Make the admin web quality gate pass — P1

- [x] Fix all current ESLint errors, including explicit `any` and unescaped JSX text.
- [x] Resolve or deliberately configure remaining warnings.
- [ ] Add component tests for login, CRUD, filters, CSV validation, settings, and API failures.
- [ ] Add at least one browser-level admin workflow test.

Verification commands:

```bash
cd admin_web && npm run lint
cd admin_web && npm run build
```

Expected result: both commands exit successfully.

### TEST-04: Add a unified CI gate — P1

- [ ] Run Go formatting/vetting/tests, Flutter analyze/tests, and Next.js lint/build on every pull request.
- [ ] Add migration and cross-tenant isolation checks.
- [ ] Prevent merge when a required job fails.

Verification:

- A deliberately failing test blocks a test pull request.
- The main branch passes every required job from a clean checkout.

---

## 7. API contract and documentation — P1

### DOC-01: Make OpenAPI authoritative

- [ ] Document every implemented route, including signup, code polling, teacher sections, roster, dashboard, history, and all admin operations.
- [ ] Add the missing admin/reporting/settings routes as they are implemented.
- [ ] Document error schemas, role requirements, and example responses.
- [ ] Validate the OpenAPI file in CI.

Verification:

- Every registered Go route appears in `api/openapi.yaml`.
- Contract tests verify representative server responses against the schema.

### DOC-02: Reconcile claims with implementation

- [ ] Correct README and `tasks.md` completion statuses.
- [ ] Decide whether QR, push notifications, CSV export, scheduling, and pilot completion are implemented or planned.
- [ ] Remove or justify "AI-assisted" terminology; the current verification engine is deterministic.
- [ ] Reconcile the documented 90-day raw-signal retention example with the implemented 24-hour pruning window.
- [ ] Move or remove the unrelated event-services marketplace PowerPoint.

Verification:

- Each checked roadmap item links to working code and a passing verification method.
- README setup instructions work from a clean checkout.

### DOC-03: Add operating documentation

- [ ] Document environment variables and development/production values.
- [ ] Add seed-data and local test-account instructions without production secrets.
- [ ] Document migrations, backup/restore, Kafka recovery, aggregate rebuilding, and notification troubleshooting.
- [ ] Add privacy and retention documentation for GPS and BSSID data.

Verification:

- A new developer can run the entire stack by following only repository documentation.
- An operator can restore data and rebuild aggregates in a staging exercise.

---

## 8. Pilot readiness and operations — P1/P2

### OPS-01: Observability — P1

- [ ] Add structured logs with request/session identifiers while excluding secrets and raw sensitive data.
- [ ] Add health/readiness checks for PostgreSQL, Redis, and Kafka.
- [ ] Measure check-in latency, rejection reasons, event lag, aggregate failures, and notification failures.
- [ ] Configure alerts for dependency outages and error-rate spikes.

Verification:

- A simulated dependency outage changes readiness state and produces an actionable alert.
- Operators can trace one check-in through verification, attendance, aggregate, and notification processing.

### OPS-02: Privacy and retention — P1

- [ ] Obtain explicit product/legal approval for retained student, GPS, and network data.
- [ ] Make the retention window configurable and verify pruning under RLS/runtime credentials.
- [ ] Define access, export, correction, and deletion procedures.

Verification:

- Seeded raw signal data older than the configured window is removed while the verification outcome remains.
- Unauthorized roles cannot access raw verification data.

### OPS-03: Performance and resilience — P1

- [ ] Define classroom-size and concurrent-session targets.
- [ ] Run reproducible API load tests against the complete infrastructure stack.
- [ ] Test PostgreSQL, Redis, and Kafka interruption/recovery behavior.
- [ ] Establish database backup and recovery objectives.

Verification:

- The agreed classroom load meets the latency/error target.
- A documented recovery exercise meets the agreed recovery objectives.

### OPS-04: Future enhancements — P2

- [ ] Evaluate beacon/face verification only after privacy review and pilot evidence.
- [ ] Evaluate Kubernetes only after deployment scale demonstrates a need.
- [ ] Add genuine AI functionality only when a defined user problem and measurable benefit exist.

---

## End-to-end pilot acceptance scenario

Run this against a clean staging environment using two colleges, at least two teachers,
and at least three students per section.

- [ ] Admin A logs in and can see only College A.
- [ ] Admin A imports users/enrollments and configures a classroom and threshold.
- [ ] Teacher A logs in and sees the assigned section.
- [ ] Teacher A starts a session and sees a rotating code.
- [ ] Teacher B cannot read or end Teacher A's session.
- [ ] An enrolled Student A checks in with valid code, BSSID, and GPS and is marked present once.
- [ ] An invalid code is rejected with a clear reason and is rate-limited after the configured attempts.
- [ ] Missing location/Wi-Fi permission cannot silently pass a required signal.
- [ ] A student with two concurrent eligible sessions is matched to the correct session.
- [ ] The teacher roster updates and a justified manual override is audit-logged.
- [ ] Ending the session marks all remaining enrolled students absent.
- [ ] Student and teacher aggregates match the source attendance records.
- [ ] Threshold crossing generates exactly one persisted notification attempt.
- [ ] Admin dashboard and CSV export show the same final values.
- [ ] College B cannot access any College A record through API, UI, or direct runtime-role SQL.
- [ ] Raw GPS/BSSID data is pruned after the configured retention window while outcomes remain.

## Release sign-off

| Responsibility | Name | Date | Result/notes |
|---|---|---|---|
| Backend/API |  |  |  |
| Student app |  |  |  |
| Teacher app |  |  |  |
| Admin web |  |  |  |
| Security/privacy |  |  |  |
| Pilot owner |  |  |  |
