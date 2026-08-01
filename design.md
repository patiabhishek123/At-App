# AtApp — Design (v1)

## 1. Design principles

- **Teacher flow must be faster than the paper sheet it replaces.** If starting a session takes longer than handing out a sheet, adoption fails regardless of how good the anti-proxy logic is.
- **Student flow is a glance-and-tap, not a form.** No typing required in the common case — scan or auto-detect, confirm, done.
- **Failure states must explain themselves.** "Check-in failed" is not acceptable; "Check-in failed — you're 340m from the classroom" is.
- **Admins get density, students and teachers get simplicity.** The website can show dense tables; the mobile apps should not.

## 2. Key user flows

### Flow A — Teacher starts a session
1. Open app → today's schedule shown, current class highlighted
2. Tap "Start attendance" on the current class
3. Full-screen rotating code appears, live roster count begins updating
4. Teacher can glance at the roster list at any time without leaving the code screen (swipe up or toggle)
5. Tap "End session" → session locks, summary shown (present/absent/override counts)

### Flow B — Student checks in
1. Push notification or in-app banner: "Attendance open for [Course]"
2. Open app → check-in screen auto-loads (camera for QR, or manual code entry as fallback)
3. App silently gathers BSSID + GPS in the background
4. Submit → result in under a second: "You're marked present" or a specific failure reason with a retry option
5. Attendance percentage for that course updates immediately, visible on the home screen

### Flow C — Threshold warning
1. Background job (Reporting Service, triggered by `attendance.recorded` events) recalculates a student's running percentage
2. If it crosses below the configured safe threshold, `threshold.breached` event fires
3. Notification Service pushes an alert to the student, with the exact number of classes they can afford to miss before falling further

## 3. Teacher app — screens

| Screen | Purpose |
|---|---|
| Today's schedule | List of the teacher's sections for the day, with a start button on the current/next one |
| Live session | Full-screen rotating code + live roster count; toggle to roster list |
| Roster list | Names with checkmarks as they check in; tap any name to manually override with a required reason |
| Course dashboard | Per-section attendance trend, list of students below threshold, CSV export |
| Session history | Past sessions for a course, each expandable to see who was present/absent/overridden |

## 4. Student app — screens

| Screen | Purpose |
|---|---|
| Home | Today's classes, current attendance % per enrolled course, banner if a session is live |
| Check-in | Auto-triggered when a session is live for an enrolled course; shows result immediately |
| Course detail | Attendance history for one course, with the safe-threshold line visible on a simple chart |
| Notifications | Threshold warnings, session reminders |

## 5. Admin website — screens

| Screen | Purpose |
|---|---|
| Institution dashboard | Attendance overview across departments/courses, filterable, exportable |
| Course/section management | Create/edit courses, sections, assign teachers, set thresholds |
| Bulk import | CSV upload for students/teachers/enrollments |
| Audit log | Searchable log of manual overrides and unusual verification-failure patterns |
| Tenant settings | Verification strictness (e.g., require all 3 signals vs. 2-of-3), academic term dates |

## 6. Visual design direction

- Clean, high-contrast, minimal color use — the teacher's rotating-code screen especially needs to be legible from the back of a room, so large type and strong contrast take priority over decoration.
- Status color use should be restricted to meaning: green = present/on-track, amber = approaching threshold, red = below threshold or verification failure. No decorative color elsewhere.
- Admin website favors density (tables, filters) over the card-heavy layouts appropriate for mobile.
