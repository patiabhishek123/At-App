<div align="center">

# AtApp

### Attendance that can't be faked. Or forgotten.

A multi-tenant, AI-assisted event services platform that replaces paper attendance
with layered, real-time verification — so teachers reclaim class time, students always
know where they stand, and admins see the whole college at a glance.

`Go` · `Flutter` · `Next.js` · `PostgreSQL` · `Redis` · `Kafka`

[Features](#key-features) · [How It Works](#how-it-works) · [Architecture](#architecture) ·
[Tech Stack](#tech-stack) · [Getting Started](#getting-started) · [Repository](#repository-structure) ·
[Roadmap](#roadmap) · [Docs](#docs)

---

[![CI - Backend](https://img.shields.io/github/actions/workflow/status/patiabhishek123/At-App/ci.yml?label=CI&logo=github&style=flat-square)](https://github.com/patiabhishek123/At-App/actions)
[![Go Version](https://img.shields.io/badge/Go-1.25-00ADD8?style=flat-square&logo=go&logoColor=white)](https://go.dev)
[![Flutter](https://img.shields.io/badge/Flutter-3.22-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![License](https://img.shields.io/badge/License-Proprietary-lightgrey?style=flat-square)](LICENSE)

</div>

---

## The Problem

College attendance today is a ritual of trust that leaks.

- **Proxy attendance is easy.** A paper sheet is signed by, or for, whoever's nearby — everyone knows it, nobody's fixed it.
- **Students find out too late.** Records surface monthly, long after the safe threshold is gone.
- **Teachers lose class time** to a process that doesn't even reliably prevent the fraud it exists to catch.

AtApp replaces the sheet with something the room itself can prove.

## Key Features

| For Students | For Teachers | For Admins |
|---|---|---|
| Join a live session in a few taps — no typing required | Start an attendance session in under 10 seconds | Cross-department dashboards, exportable in one click |
| Real-time attendance percentage per course, not a monthly surprise | Full-screen rotating check-in code with live roster | Configurable thresholds per course & section |
| Clear failure reasons — never a silent "check-in failed" | Manual overrides with a mandatory, audit-logged reason | Bulk CSV import for students, teachers & enrollments |
| Push alerts before you slip below the safe line | Per-course dashboards and CSV export | Searchable audit log of overrides & verification patterns |
| | Session history, expandable per course | Multi-college tenant onboarding |

## How It Works

1. **Teacher starts a session.** One tap generates a live, rotating check-in code tied to that exact classroom.
2. **Students check in from their seat.** The app quietly gathers the device's network, location, and the code — and submits.
3. **Everyone sees where they stand, instantly.** Students see live percentages. Teachers see who's missing. Admins see it all, across every department.

### Anti-Proxy Verification

No single signal is trusted alone. Every check-in is evaluated server-side against **three layered signals**, and a submission only passes when it meets the college's configured threshold (default: all three):

| Signal | What it proves |
|---|---|
| **Rotating code** | The student's device received a code refreshed within the last ~10 seconds |
| **BSSID match** | The device is on the specific access point registered to that classroom — not just "the college WiFi" |
| **Geofence** | The device's GPS falls within a configurable radius of the session's registered location |

Spoofing any one signal isn't enough — which is exactly the point.

## Architecture

A **modular monolith**, split by bounded context so any service can graduate to its own deployment later without a rewrite.

```
Teacher app ─┐
             ├──> API Gateway ──> Auth · Session · Verification · Attendance
Student app ─┘    (JWT, RLS)          │                 │
                                     │                 ▼
Admin website ───────────────────────┴─────────── Reporting Service
                                                       │
                       Kafka event bus ────────────────┤
                       session.started · checkin.verified · attendance.recorded · threshold.breached
                                                       │
                                        Notification Service (push alerts)
```

- **Multi-tenant from day one.** Every table and request carries a `college_id`; Postgres row-level security enforces isolation at the database layer.
- **Events for anything async.** The check-in path returns in under a second — dashboards and notifications never block it.
- **Async consumers** keep aggregates near-real-time instead of computing on read.

See [architecture.md](architecture.md) for the full design.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile (teacher, student) | **Flutter** | Native access to WiFi BSSID, geolocation, and background checks across iOS/Android |
| Admin web | **Next.js** (React + TypeScript) | Dense, dashboard-style CRUD with first-class typing |
| Backend | **Go** (modular monolith) | Concurrency suits the verification path; services split by bounded context |
| Database | **PostgreSQL 16** | Relational integrity + RLS-backed tenancy |
| Cache / short-lived state | **Redis 7** | Rotating-code TTLs and session state |
| Event bus | **Kafka / Redpanda** | Decouples notification & reporting from the check-in path |
| Auth | **JWT** (short-lived access + refresh) | Stateless, gateway-friendly |
| Infra | **Docker Compose** → Kubernetes (post-pilot) | Start lean, scale deliberately |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Go 1.25+
- Flutter 3.22+
- Node.js 20+ and npm

### 1. Start infrastructure

```bash
docker compose up -d
```

Brings up PostgreSQL (`:5433`), Redis (`:6380`), and Redpanda/Kafka (`:19092`).

### 2. Run the API gateway

```bash
cd server
go run .
```

Server boots on `:8080` with sensible dev defaults (overridable via env — see
[`config.go`](server/config/config.go)). It connects to Postgres, Redis, and Kafka,
starts the reporting/notification consumers, and launches a background pruning job
for raw verification data.

### 3. Run the apps

```bash
# Admin website (Next.js)
cd admin_web && npm install && npm run dev        # http://localhost:3000

# Teacher app (Flutter)
cd teacher_app && flutter pub get && flutter run

# Student app (Flutter)
cd student_app && flutter pub get && flutter run
```

### 4. Run the tests

```bash
cd server && go test -v ./...                     # unit + RLS cross-tenant tests
cd teacher_app && flutter test
cd student_app && flutter test
```

### API

Gateway routes are grouped under `/api/v1` (see [`openapi.yaml`](api/openapi.yaml)):

| Route | Description |
|---|---|
| `POST /auth/login` · `POST /auth/refresh` | JWT authentication for students, teachers & admins |
| `POST /admin/*` | Tenant, course, section & enrollment management |
| `POST /sessions/*` | Start/end class sessions, rotating code generation |
| `POST /verification/*` | Check-in submission evaluated against code + BSSID + geofence |
| `GET/POST /attendance/*` | Overrides, session rosters, section dashboards & history (CSV export lives client-side) |
| `GET /ping` | Health check |

## Repository Structure

```
At-App/
├── api/               # OpenAPI gateway contract
├── server/            # Go modular monolith
│   ├── main.go        # gateway entrypoint
│   ├── config/        # env-driven configuration
│   ├── db/            # Postgres/Redis connections, migrations, RLS tests
│   └── internal/
│       ├── auth/            # JWT issuance, refresh, role & tenant scoping
│       ├── admin/           # colleges, courses, sections, bulk import
│       ├── session/         # session lifecycle + rotating code (Redis TTL)
│       ├── verification/    # layered anti-proxy evaluation
│       ├── attendance/      # outcomes, overrides, aggregates
│       ├── reporting/       # event consumers → materialized aggregates
│       ├── notification/    # push notification consumers
│       ├── gateway/         # auth middleware, CORS, rate limiting
│       ├── event/           # Kafka event bus abstraction
│       └── utils/           # shared HTTP helpers
├── teacher_app/       # Flutter — teacher mobile client
├── student_app/       # Flutter — student mobile client
├── admin_web/         # Next.js — admin dashboard
├── .github/           # CI: Go tests/lint, Flutter analyze/test, Next.js checks
├── docker-compose.yml # Postgres + Redis + Redpanda
├── architecture.md    # system design
├── prd.md             # product requirements
└── design.md          # UX & visual direction
```

## Roadmap

Phase 0–6 of the build plan are complete (see [tasks.md](tasks.md)):

- [x] Monorepo, CI, RLS tenancy, API contract
- [x] All backend services (auth, admin, session, verification, attendance, reporting, notification)
- [x] Teacher app — live code screen, roster, overrides, course dashboards
- [x] Student app — QR/manual check-in, background signals, threshold alerts
- [x] Admin web — dashboards, CSV import, audit log, tenant settings
- [x] Verification hardening — rate limiting, N-of-3 signals, audit pruning, load path
- [ ] Pilot onboarding & on-site AP calibration
- [ ] Face/beacon recognition as an optional v2 signal
- [ ] Kubernetes deployment for multi-college scale

## Docs

- [Product Requirements](prd.md)
- [Architecture](architecture.md)
- [Data Model](data_model.md)
- [UX Design (v1)](design.md) · [Visual System (v2)](DESIGN.md)
- [Landing Page Content](landing_page.md)
- [Build Plan & Tasks](tasks.md)

## License

Proprietary. All rights reserved.
