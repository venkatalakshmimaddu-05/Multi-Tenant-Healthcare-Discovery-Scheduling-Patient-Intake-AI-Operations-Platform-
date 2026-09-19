# AuraCare Health: Autonomous Multi-Hospital Patient Intake & AI Voice Platform

[![Tests](https://img.shields.io/badge/tests-41%20passed-brightgreen.svg)](tests)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-blue.svg)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-darkblue.svg)](https://www.prisma.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org)
[![PRD Version](https://img.shields.io/badge/PRD%20Version-2.0%20Concise-emerald.svg)]()

> **Autonomous Multi-Hospital Patient Intake, Scheduling & Pre-Visit Voice Agent Platform**  
> Built strictly according to the 35-page Product Requirements Document (PRD v2.0 Candidate Edition).

---

## 1. Project Overview & Product Goal

Traditional hospital booking requires patients to navigate confusing departments, clinician directories, and disconnected portals. **AuraCare** transforms healthcare access into an **AI-native conversational experience** across Web Voice, Telephone simulation, and Chat.

Patients describe their medical needs in plain natural language:
> *"I need to see a doctor for my shoulder pain sometime this week."*

The system:
1. Understands administrative intent and maps symptoms to specialties.
2. Discovers certified physicians in accredited hospitals.
3. Checks **real availability** and blocks phantom slots.
4. Prevents concurrent double-booking with atomic mutex reservation locks.
5. Coordinates with external Electronic Health Record (EHR) systems through a pluggable connector.
6. **Verifies the external record directly before confirming success to the patient.**
7. Dispatches asynchronous workflows: assigning pre-visit clinical intake questionnaires and notifying care teams.
8. Provides complete end-to-end auditability linked by a persistent **Correlation ID**.

---

## 2. Core Architecture & Stack

```
Interfaces (Web Voice / Phone Simulator / Patient / Doctor / Admin)
  │
  ▼
AI Agent & Context Engine (Multi-Turn NLU, PRD Sec 20 Clinical Guardrails)
  │
  ▼
Controlled Capability Layer (16 Audited Capability Interfaces)
  │
  ├──────────────────────────────┬──────────────────────────────┐
  ▼                              ▼                              ▼
Central Scheduling Engine    EHR Integration Layer       Workflow Engine
- Real Availability          - EhrConnectorInterface     - Intake Assignment
- Double-Booking Mutex Lock  - External Verification     - Event Notifications
- Working Hours & Time-off   - Fault Recovery (Opt A/B/C)- Schedule Sync
  │                              │                              │
  └──────────────────────────────┴──────────────────────────────┘
                                 │
                                 ▼
         Durable Relational Database (Prisma ORM & SQLite)
     Multi-Tenant Isolation • Correlation ID Traces • Audit Events
```

### Technology Selection Rationale:
- **Next.js 14 (App Router) & React**: Fast unified prototype speed, server components, and responsive modern frontend.
- **TypeScript**: Complete type-safety across capability schemas, EHR requests, and domain models.
- **Prisma ORM & SQLite**: Zero-configuration, durable relational store supporting foreign keys, transactions, and tenant isolation without requiring external database provisioning.
- **Web Speech API & Web Audio**: Real-time microphone capture, turn-taking, barge-in, and speech synthesis with perceived latency monitoring.
- **Vitest**: High-performance automated testing for scheduling calculations, concurrency mutex locks, clinical guardrails, and EHR failure recovery.

---

## 3. Four Role-Based Portals & Live Persona Switcher

The top navigation bar contains a **Live Role Switcher** and **EHR Fault Injector** allowing an evaluator to seamlessly test every workflow:

1. **AI Voice & Telephone Agent (`/patient/assistant`)**:
   - Web Voice assistant with visual audio waveform and sub-2s latency counter.
   - Inbound Telephone Call simulator (`1-800-METRO-CARE`) with caller ID detection, phone dial pad, and live transcript.
   - Real-time **Controlled Capability Execution Drawer** showing the evaluator live input/output JSON for every tool call.
   - Inline **Pre-Visit Clinical Intake Questionnaire** triggered immediately upon appointment confirmation.
2. **Patient Portal (`/patient`)**:
   - Overview of confirmed, rescheduled, and cancelled appointments.
   - Real-time EHR Verification status pill (`VERIFIED`, `RECONCILIATION_REQUIRED`).
   - One-click cancel/reschedule actions.
3. **Doctor Portal (`/doctor`)**:
   - Switch between **Dr. Ananya Rao** (Orthopedics) and **Dr. Marcus Chen** (Cardiology).
   - Daily patient consultation schedule.
   - **Pre-Visit Intake Inspector**: Review structured patient questionnaire responses (pain level 1-10, prior imaging, mobility aids) prior to consultation.
   - Doctor-controlled availability: Block slot tool for emergency surgeries or ward rounds.
4. **Hospital Admin Portal (`/hospital-admin`)**:
   - Manage facility profiles, clinical departments, physician rosters, and EHR connector settings.
5. **Platform Admin & Trace Explorer (`/platform-admin`)**:
   - Hospital onboarding lifecycle review queue (`Draft` &rarr; `Submitted` &rarr; `Under Review` &rarr; `Approved/Rejected`).
   - **Correlation ID Trace Explorer**: Search by Correlation ID to view the full pipeline (`Voice Turn -> Capability -> Scheduling -> EHR -> Verification -> State Sync -> Notification`).
   - Global system metrics and AI latency tracking.

---

## 4. PRD Section 28: EHR Failure Demonstration & Recovery

The platform includes a dedicated **EHR Fault Simulation Control Panel** in the top bar and admin dashboard to demonstrate all required failure scenarios:

- **Option A: EHR Timeout & Automatic Retry**:
  - Simulates an `HTTP 504 Gateway Timeout` during booking.
  - Classifies the failure as `RETRYABLE_TIMEOUT`.
  - Automatically retries using the preserved `idempotencyKey`.
  - Verifies the external record and synchronizes internal state to `CONFIRMED`.
- **Option B: Unknown Outcome Recovery (Packet Drop After Write)**:
  - Simulates a network socket hangup after the EHR creates the record.
  - Rather than blindly creating a duplicate appointment, the system queries the EHR directly by idempotency key.
  - Locates the existing record and synchronizes state **without duplicate creation**.
- **Option C: Unrecoverable Outage & Human Escalation**:
  - Simulates complete EHR cluster outage (`HTTP 503`).
  - Retries are exhausted; system flags appointment as `RECONCILIATION_REQUIRED`.
  - Creates a durable `ReconciliationRecord` in status `PENDING_REVIEW`.
  - Dispatches an operator alert and routes to the Human Escalation queue.

---

## 5. Getting Started & Setup

### Prerequisites
- Node.js 18+ (tested on Node.js v24)
- npm 9+

### Installation & Launch

```bash
# 1. Navigate to project root
cd healthcare-voice-platform

# 2. Install dependencies
npm install

# 3. Generate Prisma client & initialize SQLite database
npx prisma generate
npx prisma db push

# 4. Seed database with hospitals, doctors, calendars & questionnaires
npx tsx prisma/seed.ts

# 5. Run automated test suite
npm test

# 6. Start the local development server
npm run dev
```

Open your browser at: **`http://localhost:3000`**

### Database Architecture: Local Evaluation (SQLite) vs. Production (PostgreSQL 16)

The storage layer is engineered with a **Dual-Target Database Strategy** via Prisma ORM:

- **Default for Local Evaluation: Embedded SQLite (`prisma/dev.db`)**
  - **Zero-Friction Review**: Reviewers can clone and run `npm run dev` instantly without installing PostgreSQL, managing background daemons, or configuring database passwords.
  - Fully supports relational models, ACID transactions, foreign keys, and multi-tenant isolation out-of-the-box.

- **Enterprise Production Mode: PostgreSQL 16 + Redis (`docker-compose.yml`)**
  - Includes a production Docker Compose orchestration file (`docker-compose.yml`) pre-configured with PostgreSQL 16 Alpine and Redis 7 Alpine.
  - To run with PostgreSQL:
    ```bash
    # 1. Boot PostgreSQL 16 and Redis containers
    docker compose up -d

    # 2. In prisma/schema.prisma: change provider = "sqlite" to provider = "postgresql"
    # 3. In .env: set DATABASE_URL (see .env.example for pre-configured connection string)
    # 4. Run enterprise migrations:
    npx prisma migrate dev --name init
    ```

---

## 6. Demo Accounts & Seed Data

| Role | Name / Facility | Key Identifier | Description |
| :--- | :--- | :--- | :--- |
| **Patient** | Alex Morgan | `alex.morgan@example.com` / `+1-555-0199` | Primary patient with orthopedic context |
| **Doctor** | Dr. Ananya Rao, MD | Board Certified Orthopedics | Metro Health Medical Center (9 AM - 5 PM) |
| **Doctor** | Dr. Marcus Chen, MD | Interventional Cardiology | Metro Health Medical Center (9 AM - 5 PM) |
| **Hospital** | Metro Health Medical Center | `APPROVED` | Primary multi-specialty teaching hospital |
| **Hospital** | Apex Specialty Institute | `UNDER_REVIEW` | Used to demonstrate Platform Admin Onboarding Approval |
| **Super Admin**| Platform Operations | Global Scope | Oversees onboarding, health & correlation traces |

---

## 7. Automated Test Suite

Run tests via Vitest:
```bash
npm test
```

### Verified Test Matrix:
- `tests/unit/availability.test.ts`:
  - Availability calculation within working hours
  - Concurrency double-booking mutex locking
  - PRD Section 20 clinical safety refusal guardrail
  - Multi-turn context resolution ("Actually, make that Friday")
- `tests/integration/bookingFlow.test.ts`:
  - Complete booking, external EHR write, verification loop, and state synchronization.
- `tests/integration/ehrFailureRecovery.test.ts`:
  - Option A: EHR timeout & auto-retry recovery.
  - Option B: Unknown outcome reconciliation & duplicate prevention.
  - Option C: Unrecoverable outage & reconciliation escalation.

---

## 8. Documentation Index

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): Layered architecture, security model, and capability specifications.
- [`docs/BOOKING_SEQUENCE.md`](docs/BOOKING_SEQUENCE.md): Detailed Mermaid sequence diagram of the entire booking lifecycle.
- [`docs/EHR_INTEGRATION_AND_FAILURE_RECOVERY.md`](docs/EHR_INTEGRATION_AND_FAILURE_RECOVERY.md): EHR connector design and Option A/B/C failure handling protocols.
- [`docs/AI_SYSTEM_AND_SAFETY.md`](docs/AI_SYSTEM_AND_SAFETY.md): Administrative safety guardrails, prompt engineering, and voice turn-taking.