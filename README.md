# Doctor Tracker — Backend API

> Production-grade RESTful API service for the Doctor Tracker administrative portal. Built with Node.js 20, Express, TypeScript, and MongoDB 7 (Replica Set).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0_ReplicaSet-green.svg)](https://www.mongodb.com/)


---

## 1. Elevator Pitch

**Doctor Tracker** is a secure, high-performance administrative portal designed for healthcare facility supervisors to manage medical rosters and patient assignments with zero administrative friction. Built to handle 10,000+ patient records and 500+ doctor profiles effortlessly, the backend powers sub-millisecond indexed searches, ACID transactional patient assignment, auto-reconciled workload metrics, and structured analytics for clinical operations.

---

## 2. System Architecture

```
┌────────────────────┐   HTTPS / REST    ┌─────────────────────────┐   Mongoose ODM   ┌──────────────────────────┐
│  Browser           │ ────────────────▶ │  Next.js Frontend       │ ───────────────▶ │  MongoDB 7 (Replica Set) │
│  (React UI)        │                   │  /api/* Rewrite Proxy   │                  │  - Collections:          │
└────────────────────┘                   └───────────┬─────────────┘                  │    • users               │
                                                     │ server-to-server               │    • refresh_tokens      │
                                                     ▼                                │    • doctors             │
                                         ┌─────────────────────────┐                  │    • patients            │
                                         │  Express API Server     │ ───────────────▶ │  - Compound Indexes      │
                                         │  (Port 4000)            │                  │  - ACID Transactions     │
                                         └─────────────────────────┘                  └──────────────────────────┘
```

### Request & Auth Flow
1. **First-Party Cookie Isolation**: The client interacts via `/api/*` rewrites. Browser sessions receive `httpOnly`, `SameSite=Lax` cookies (`dt_access` for 15-min access token, `dt_refresh` scoped to `/api/v1/auth/refresh` for 7-day refresh).
2. **Security Hardening**: All inbound requests pass through `helmet`, CORS validation, rate limiting (`express-rate-limit`), and a unique request tracking ID middleware.
3. **Validation & Type Safety**: Query parameters, URL parameters, and request bodies are validated strictly via Zod schemas prior to controller delegation.
4. **Data Isolation & Transactions**: Creating or deleting a patient runs inside a MongoDB multi-document transaction to simultaneously update the patient record and atomic `patientCount` on the corresponding doctor record.

---

## 3. Tech Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js with TypeScript
- **Database & ODM**: MongoDB 7.0 (single-node replica set `rs0` for transaction support), Mongoose 8
- **Authentication**: JWT (`jsonwebtoken`) + Argon2 password hashing + cryptographically random refresh token family rotation
- **Validation**: Zod 3.24
- **Security & Logging**: Helmet, CORS, Express-Rate-Limit, Cookie-Parser, Pino & Pino-HTTP
- **Testing & Tooling**: Vitest, Supertest, MongoDB Memory Server, tsx

---

## 4. Setup Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or v20+ recommended)
- [Docker](https://www.docker.com/) & Docker Compose (for MongoDB replica set)

### 1. Clone & Install
```bash
git clone https://github.com/SAIFUL-SIFAT/doctor-tracker-backend.git
cd doctor-tracker-backend
npm install
```

### 2. Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
Default `.env` values:
```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27018/doctor_tracker?directConnection=true
JWT_ACCESS_SECRET=change-me-to-a-32+-char-random-string
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
CLIENT_ORIGIN=http://localhost:3000
COOKIE_SECURE=false
APP_TIMEZONE=Asia/Dhaka
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=ChangeMe123!
```

### 3. Start MongoDB Replica Set
```bash
docker compose up -d
```
> **Note**: Port `27018` is mapped to container port `27017` with replica set `rs0` initiated automatically, enabling MongoDB transactions locally.

### 4. Seed Database (500 Doctors & 10,000 Patients)
```bash
npm run seed
```
This populates the database with:
- 1 Admin user (`admin@example.com` / `ChangeMe123!`)
- 500 Realistic doctors with weighted specializations and indexed `nameLower`
- 10,000 Patients with realistic clinical conditions, dates, and assigned doctor workloads
- Synced indexes and accurate `patientCount` counters

### 5. Run the Server
```bash
# Development (with auto-reload)
npm run dev

# Production Build & Start
npm run build
npm start
```
The server will be reachable at `http://localhost:4000` (Healthcheck: `http://localhost:4000/health`).

---

## 5. Demo Credentials

| Role | Email | Password |
|---|---|---|
| **System Administrator** | `admin@example.com` | `ChangeMe123!` |

---

## 6. Technical Decisions (ADRs)

### ADR-1: Reference Patients by `doctorId` + Denormalized `patientCount` (Not Embedded Array)
- **Context**: In healthcare administrative systems, patients require independent pagination, filtering, editing, and deletion. Doctors simultaneously require quick sort and filtering by workload.
- **Decision**: Keep a standalone `patients` collection referencing `doctorId`, while denormalizing an integer `patientCount` on each doctor document.
- **Why**: Embedding patient subdocuments in the doctor document would create unbounded arrays, quickly threatening MongoDB's 16 MB BSON document limit and making patient-level pagination, global searching, and status updates inefficient. The transactional counter allows `sort({ patientCount: -1 })` to execute instantly using an index.
- **Trade-offs**: Writes require multi-document transactions to maintain consistency. A reconciliation script (`npm run reconcile`) is included to repair counters if an uncommitted operation ever drifts.

### ADR-2: Refresh Token Family Rotation & HttpOnly Cookie Delivery
- **Context**: Admin authentication must protect against XSS token theft without introducing cross-site cookie or third-party storage complexities.
- **Decision**: Deliver tokens via `httpOnly`, `SameSite=Lax` cookies with refresh token family tracking.
- **Why**: If a refresh token is reused or hijacked, the entire token family is revoked immediately, safeguarding against session replay.

---

## 7. API Summary

All endpoints are prefixed with `/api/v1` and return standard JSON envelopes (`{ data: ..., meta?: ... }`).

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/login` | Authenticate admin, issues `dt_access` and `dt_refresh` cookies | Public (Rate-limited) |
| `POST` | `/auth/refresh` | Rotate access and refresh tokens | Public (Cookie required) |
| `POST` | `/auth/logout` | Revoke session and clear cookies | Public |
| `GET` | `/auth/me` | Fetch active authenticated user profile | Authenticated |
| `GET` | `/doctors` | Paginated, filtered, and sorted doctors list | Authenticated |
| `POST` | `/doctors` | Create a new doctor | Admin |
| `GET` | `/doctors/:id` | Retrieve single doctor details | Authenticated |
| `GET` | `/doctors/:id/patients` | Paginated list of patients under a specific doctor | Authenticated |
| `POST` | `/doctors/:id/patients` | Register and assign patient to doctor (transactional) | Admin |
| `DELETE` | `/doctors/:id/patients/:patientId` | Unassign/remove patient from doctor (transactional) | Admin |
| `GET` | `/doctors/meta/filters` | Distinct specializations and hospitals for filter menus | Authenticated |
| `GET` | `/patients` | Global paginated list of all patients across doctors | Authenticated |
| `GET` | `/patients/:id` | Retrieve patient record by ID | Authenticated |
| `PATCH` | `/patients/:id` | Update patient record | Admin |
| `DELETE` | `/patients/:id` | Delete patient and decrement doctor's workload | Admin |
| `GET` | `/dashboard/summary` | KPI aggregates (doctors, patients, avg load, 30d new) | Authenticated |
| `GET` | `/dashboard/patients-per-doctor` | Top 10 doctors ranked by patient workload | Authenticated |
| `GET` | `/dashboard/registrations` | Daily patient registrations over 7d/30d/90d | Authenticated |
| `GET` | `/dashboard/conditions` | Patient breakdown by medical condition | Authenticated |
| `GET` | `/dashboard/specializations` | Doctor distribution across clinical specializations | Authenticated |

---

## 8. Query Performance & Explain Results

The database design guarantees zero `COLLSCAN` queries under the 10,000+ patient seed dataset.

Run the query performance benchmark:
```bash
npm run explain
```

### Benchmark Summary on 10,500 Seeded Documents:
| Query Operation | Index Used | Execution Stage | Docs Examined / Returned |
|---|---|---|---|
| **Doctors Default List (Sort & Limit)** | `{ createdAt: -1, _id: -1 }` | `IXSCAN` ➔ `FETCH` | 20 / 20 (Optimal) |
| **Doctors Filter by Specialization** | `{ specialization: 1, createdAt: -1 }` | `IXSCAN` ➔ `FETCH` | 20 / 20 (Optimal) |
| **Doctor Workload Ranking** | `{ patientCount: -1, _id: 1 }` | `IXSCAN` ➔ `FETCH` | 10 / 10 (Zero memory sort) |
| **Doctor Scoped Patients** | `{ doctorId: 1, createdAt: -1, _id: -1 }` | `IXSCAN` ➔ `FETCH` | 20 / 20 (Optimal) |
| **Patients Condition Filter** | `{ condition: 1, createdAt: -1 }` | `IXSCAN` ➔ `FETCH` | 20 / 20 (Optimal) |
| **Prefix Search by Name** | `{ nameLower: 1 }` | `IXSCAN` ➔ `FETCH` | Direct range scan |

---

## 9. Utility Scripts

- `npm run seed`: Wipe and reseed 500 doctors, 10,000 patients, and admin user.
- `npm run reconcile`: Audit and recalculate `patientCount` values across all doctors.
- `npm run db:sync-indexes`: Synchronize and build all indexes programmatically in MongoDB.
- `npm run explain`: Run query execution stat analysis against the active database.
- `npm test`: Run test suite with Vitest.
