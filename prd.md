# AtApp — Product Requirements Document (v1)

## 1. Problem statement

College attendance today is manual: a physical sheet is passed around, signed after class ends, and often signed on behalf of absent students (proxy attendance). Records are compiled and uploaded at the end of the month, so students only learn they're below the minimum-attendance threshold once it's too late to correct course. Teachers lose class time to a process that doesn't even reliably prevent the fraud it exists to catch.

## 2. Goals (v1)

- Let a teacher start an attendance session in under 10 seconds.
- Let a student mark themselves present in a few taps, only while physically in the room.
- Make attendance percentage visible to students in real time, not monthly.
- Make proxy attendance meaningfully harder without adding friction for honest students.
- Give admins a live, exportable view of attendance across departments.
- Support multiple colleges on one platform (multi-tenant from day one).

## 3. Non-goals (v1)

- No biometric/face-recognition check-in (flagged as a v2 option for high-stakes courses).
- No offline-first attendance capture (v1 assumes campus WiFi/data connectivity).
- No timetable/scheduling engine — course/section timing is entered manually by admins, not auto-generated.
- No payment or billing system for colleges (assume pilot/free tier for v1).
- No native web app for students/teachers — mobile only for those roles; web is admin-facing only in v1.

## 4. Users & personas

| Persona | Needs |
|---|---|
| **Student** | Fast, low-friction check-in; real-time visibility into attendance %; clear reason if a check-in fails. |
| **Teacher** | One-tap session start; live roster as students check in; manual override with audit trail; per-course reporting. |
| **College admin** | Cross-department dashboards; ability to configure attendance thresholds; exportable records for compliance. |
| **Platform admin (you)** | Onboard new colleges; monitor system health across tenants. |

## 5. Core features (v1 scope)

### Teacher app (mobile)
- Start/end a class session tied to a course + section
- Rotating check-in code, refreshed every 8–10s, shown full-screen
- Live roster view as students check in
- Manual present/absent override, with mandatory reason (audit-logged)
- Per-course attendance dashboard and CSV export

### Student app (mobile)
- Join a session via rotating code (auto-submits verification signals)
- Real-time personal attendance percentage per course
- Clear failure reasons if check-in doesn't register (expired code, out of range, etc.)
- Push notification if attendance drops near the safe threshold

### Admin website
- Institution-wide attendance dashboard, filterable by department/course/section
- Threshold configuration per course
- Bulk student/teacher/course import (CSV)
- Audit log viewer (manual overrides, failed verification patterns)
- Tenant (college) onboarding and management

## 6. Anti-proxy verification requirements

No single signal is sufficient on its own (see rationale in architecture.md). v1 requires the following layered checks, all evaluated server-side at submission time:

1. **Rotating session code** — proves the student's device received a code refreshed within the last ~10 seconds.
2. **BSSID match** — device must be connected to the specific access point registered to that classroom, not just "the college WiFi."
3. **Geofence** — device GPS must fall within a configurable radius of the session's registered location.

A check-in is accepted only if it passes a configurable minimum number of these checks (default: all three; admins may relax to 2-of-3 for weak-signal buildings).

## 7. Success metrics

- % reduction in manual override rate over a semester (proxy for proxy-attendance reduction)
- Median time to start a session (target: <10s)
- Median time for a student to check in (target: <5s)
- % of students who report finding their real-time attendance % before month-end (survey-based, post-pilot)

## 8. Assumptions & constraints

- Pilot college(s) have WiFi coverage in classrooms with distinguishable per-room access points.
- Students and teachers have smartphones capable of running Flutter apps (iOS 13+/Android 8+).
- FERPA/local-equivalent student data privacy rules apply — attendance and location data must be handled accordingly (see architecture.md security section).

## 9. Risks

- **WiFi access point sharing**: some buildings may have one AP covering multiple rooms — requires per-college calibration during onboarding.
- **GPS accuracy indoors**: geofence may need a generous radius in dense buildings; treated as a secondary signal, not primary.
- **Trust/friction tradeoff**: over-tightening verification risks false negatives (honest students marked absent) — needs a teacher override path with audit trail, not just a hard block.
