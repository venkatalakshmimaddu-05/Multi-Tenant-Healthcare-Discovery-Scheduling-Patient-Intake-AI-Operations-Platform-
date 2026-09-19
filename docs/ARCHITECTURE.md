# System Architecture Documentation

## 1. High-Level Architectural Overview

The **Autonomous Multi-Hospital Patient Intake, Scheduling & Pre-Visit Voice Agent Platform** is designed following strict layered domain separation. The system separates conversational intelligence, scheduling availability rules, external healthcare integration, workflow automation, and multi-tenant security into distinct components.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User & Access Interfaces                        │
│   Web Voice (Speech API) │ Inbound Telephone Simulator │ Web Chat UI   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    AI Agent & Context Engine Layer                     │
│  - Natural Language Understanding (Intent & Entity Parsing)            │
│  - Context Store (Pronoun & Relative Date Resolution: 'make that Fri') │
│  - Clinical Guardrails (Administrative Only - Refuses Diagnoses)       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Controlled Capability Layer                       │
│  - search_hospitals         - create_appointment (with Mutex Lock)     │
│  - search_doctors           - reschedule_appointment                   │
│  - check_availability       - cancel_appointment                       │
│  - get_questionnaire        - submit_questionnaire                     │
│  - verify_external_record   - transfer_to_human                        │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│     Central Scheduling Engine     │ │   Healthcare / EHR Integration   │
│  - Working Hours Filter           │ │  - EhrConnectorInterface         │
│  - Blocked Slot Subtraction       │ │  - Pluggable Adapters (FHIR/Mock)│
│  - Concurrency Mutex Reservation  │ │  - External Verification Loop    │
│  - Real-time Slot Revalidation    │ │  - Fault Recovery (Option A/B/C) │
└───────────────────┬───────────────┘ └──────────────┬───────────────────┘
                    │                                │
                    └────────────────┬───────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Core Domain & Workflow Engine                     │
│  - Asynchronous Workflow Runner (Delays, Conditions, Retries)          │
│  - Pre-Visit Questionnaire Assignment & Doctor Review                  │
│  - Audit & Observability Engine (Correlation ID Tracing)               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Tenant Security & Tenant Isolation

Tenant isolation is strictly maintained across all operations:
- **Hospital Isolation**: Each hospital (`Hospital` entity) has isolated clinical departments, doctors, calendars, questionnaires, and workflows. A Hospital Admin from Hospital A can never access or modify data belonging to Hospital B.
- **Role-Based Access Control (RBAC)**:
  - `PLATFORM_ADMIN`: Approves hospital onboarding applications, oversees platform health, inspects end-to-end correlation traces, and simulates EHR faults.
  - `HOSPITAL_ADMIN`: Manages their hospital's physicians, availability configurations, intake questionnaires, and integration settings.
  - `DOCTOR`: Manages personal calendar, time-off blocking, and reviews patient pre-visit intake questionnaires.
  - `PATIENT`: Interacts with the AI Voice Agent, books/manages appointments, completes intake forms, and sets communication preferences.

---

## 3. Explicit State Management (PRD Section 23)

Application state is decoupled across explicit lifecycle stores rather than stored as an opaque AI memory object:
1. **Transactional State**: Durable business records in SQLite (`CONFIRMED`, `CANCELLED`, `RESCHEDULED`).
2. **Conversational State**: Active interaction context (`currentIntent`, `selectedDoctorId`, `selectedSlotTime`).
3. **User Context & Preferences**: Patient historical preferences (`preferredDays`, `preferredTimeOfDay`).
4. **Integration State**: External EHR synchronization state (`VERIFIED`, `RECONCILIATION_REQUIRED`).
5. **Workflow State**: Execution progress of post-booking processes (`RUNNING`, `COMPLETED`, `RETRIED`).
6. **Operational State**: Global health metrics, latencies, and reconciliation queues.

---

## 4. Controlled Capability Interface (PRD Section 9 & 10)

The AI agent does not directly touch the database or external EHR. All actions must invoke registered capabilities:
- `search_hospitals`: Discovers approved facilities.
- `search_doctors`: Discovers active specialists by symptom or name.
- `check_availability`: Computes bookable slots using live calendar rules.
- `create_appointment`: Locks slot, calls EHR, verifies external record, syncs internal state, triggers post-booking workflows.
- `reschedule_appointment`: Revalidates slot, updates EHR, releases old slot.
- `cancel_appointment`: Releases slot, notifies EHR, and informs patient.
- `get_questionnaire` & `submit_questionnaire`: Collects and stores clinical pre-visit intake data.
- `transfer_to_human`: Escalates unrecoverable failures or clinical emergencies to human staff.