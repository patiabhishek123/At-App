# At-App (Attendance App)

Full-stack attendance tracking system with role-based access, real-time classroom session broadcasts, and PostgreSQL-backed academic hierarchy (branch/year/subject).

## Project Analysis (Current State)

This repository is structured as a **monorepo with two apps**:

- [client](client): React + TypeScript + Vite dashboard UI
- [server](server): Express + TypeScript + PostgreSQL + WebSocket backend

### What is implemented

- Student registration/login with JWT auth
- Teacher demo token flow (`/api/auth/teacher/demo-token`)
- Branch/year-aware subject hierarchy
- Teacher-subject mapping (`teacher_subjects`)
- Start/end class sessions
- Student attendance marking with validations:
	- session active + not expired
	- student eligibility by branch/year
	- subnet/IP consistency check
- Live WebSocket events:
	- `session.started`
	- `session.ended`
	- `attendance.marked`
- Teacher/admin attendance summary + CSV export endpoints

### Architecture notes

- Backend table initialization is triggered on server boot (`ensureStudentsTable()`, `ensureSessionTables()`).
- API routes are grouped under `/api`.
- WebSocket endpoint is `/ws` on the same backend host.

### Important configuration mismatch to know

- Server `.env.example` uses `PORT=5000`.
- Client defaults use `http://localhost:8000/api` and `ws://localhost:8000`.

If unchanged, frontend requests will fail. Either:

1. Run server on `8000`, or
2. Set client env vars to point to `5000`.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, TailwindCSS
- Backend: Node.js, Express 4, TypeScript
- Database: PostgreSQL
- Auth: JWT + bcrypt
- Realtime: ws (WebSocket)

## Getting Started

## 1) Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+

## 2) Server setup

Copy [server/.env.example](server/.env.example) to `server/.env` and update values:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/at_app
JWT_SECRET=replace_with_a_strong_secret
SESSION_VALIDITY_SECONDS=30
```

Then install and run:

```bash
cd server
npm install
npm run dev
```

## 3) Client setup

Create `client/.env` (recommended):

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000
```

Then install and run:

```bash
cd client
npm install
npm run dev
```

## 4) Health check

```http
GET /api/health
```

Expected:

```json
{ "status": "ok" }
```

## Key API Endpoints

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/teacher/demo-token`
- `GET /api/auth/branches`
- `GET /api/auth/years`

Sessions:

- `POST /api/sessions/start` (teacher)
- `POST /api/sessions/end` (teacher/admin)
- `POST /api/sessions/:id/end` (teacher/admin)
- `GET /api/sessions/:id/attendance` (teacher/admin)
- `GET /api/sessions/:id/attendance/summary` (teacher/admin)
- `GET /api/sessions/:id/attendance/csv` (teacher/admin)

Attendance:

- `POST /api/attendance/mark` (student)

Student dashboard:

- `GET /api/student/stats`
- `GET /api/student/history`

Teacher dashboard:

- `GET /api/teacher/subjects`
- `POST /api/teacher/subjects`

## Database

- Prisma schema: [server/prisma/schema.prisma](server/prisma/schema.prisma)
- SQL schema: [server/db/attendance_schema.sql](server/db/attendance_schema.sql)

Core entities:

- `branches`, `years`
- `students`, `teachers`
- `subjects`, `teacher_subjects`
- `sessions`, `attendance`

## Additional Project Docs

- [REFACTORING_GUIDE.md](REFACTORING_GUIDE.md)
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md)
- [VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md)

## Suggested Next Improvements

- Add root-level scripts to run client/server together.
- Add Docker Compose for Postgres + apps.
- Add automated tests (API + integration).
- Add `.env.example` for client.
- Add CI pipeline for lint/build/test.

