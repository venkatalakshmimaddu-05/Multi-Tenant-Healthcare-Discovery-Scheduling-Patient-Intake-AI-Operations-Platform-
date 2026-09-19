# AuraCare AI — System Architecture Documentation
**Autonomous Multi-Tenant Healthcare Access, Clinical Triage & Central Scheduling Platform**

---

## 1. High-Level Architectural Topology

```
                                PATIENT CHANNELS
              ┌─────────────────────────┴─────────────────────────┐
              ▼                                                   ▼
     [Telephone Dial-In]                                 [Web / WebRTC Voice]
   (Twilio Voice & TwiML)                              (MediaDevices / AudioContext)
              │                                                   │
              └─────────────────────────┬─────────────────────────┘
                                        ▼
                         [Autonomous AI Agent Engine]
             (Natural Language Understanding, Intent & State Machine)
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
[Clinical Triage Engine]     [Central Scheduling Engine]     [EHR Integration Broker]
 ├─ Clinical Entity Extractor ├─ Distributed Redis Lock       ├─ FHIR Appointment Resource
 ├─ 4-Way Polarity Analyzer   ├─ Concurrency Shield           ├─ Idempotent Retries
 ├─ Red-Flag Safety Layer     ├─ Multi-Hospital Discovery     ├─ Unknown Outcome Recovery
 └─ Specialty Router          └─ Atomic Slot Commit           └─ Outage Reconciliation
           │                            │                            │
           └────────────────────────────┼────────────────────────────┘
                                        ▼
                           [Prisma Multi-Tenant ORM]
                                        ▼
                         [PostgreSQL / SQLite Database]
 ┌──────────────────────┬──────────────────────┬──────────────────────┐
 │ Hospital Tenants (3) │ Doctor Rosters (9)   │ Departments (9)      │
 ├──────────────────────┼──────────────────────┼──────────────────────┤
 │ Appointments & Slots │ Questionnaires (9)   │ Audit Traces (160+)  │
 └──────────────────────┴──────────────────────┴──────────────────────┘
```

---

## 2. The 9-Stage Clinical Reasoning & Safety Pipeline

Compliant with PRD Section 20 Clinical Safety Guardrails:

1. **Patient Input:** Captures patient voice or text without loss of verbatim wording.
2. **Entity Extraction:** Extracts clinical concepts across 9 organ systems without guessing diagnosis.
3. **Structured State:** Maintains persistent state with 4-way polarity (`PRESENT`, `NEGATED`, `UNCERTAIN`, `UNKNOWN`).
4. **Red-Flag Screening:** Deterministic safety layer evaluates ACS, Stroke (FAST), Thunderclap, Acute Abdomen, and Anaphylaxis prior to scheduling. Mandatory 911 / ER refusal.
5. **Missing-Information Detection:** Prioritized by clinical risk: Emergency risk > Differential discrimination > Care level.
6. **Differential Consideration:** Formulates differentials with expressed clinical uncertainty.
7. **Dynamic Follow-Up:** Selects at most ONE focused question per voice dialogue turn.
8. **Specialty Triage:** Routes accurately to the appropriate medical specialty.
9. **Voice Response:** Formulates empathetic response with auditable `reasoning_basis`.

---

## 3. Multi-Tenancy & Cryptographic RBAC

- **PLATFORM_ADMIN:** Global super-admin for tenant approval, system health, and end-to-end trace auditing.
- **HOSPITAL_ADMIN:** Scoped to `hospitalId`. Manages hospital doctors, departments, scheduling rules, and EHR connector settings.
- **DOCTOR:** Scoped to `doctorId`. Physicians manage their consultation calendar, review patient pre-visit questionnaires, and block personal time slots. Cross-doctor viewing is blocked by `TenantGuard`.
- **PATIENT:** Scoped to `patientId`. Patients book appointments and submit clinical intake questionnaires.

---

## 4. EHR Connector & PRD Section 28 Failure Recovery

- **Option A (Transient Timeout):** Classifies timeouts as retryable; safely retries with a unique `idempotencyKey`.
- **Option B (Unknown Outcome):** Queries the external EHR before inserting to prevent duplicate appointments upon network drop.
- **Option C (Unrecoverable Outage):** Creates a `RECONCILIATION_REQUIRED` record and dispatches an urgent alert to clinic coordinators.

---

## 5. Distributed Concurrency & Double-Booking Shield

- Acquires distributed locks on `lock:doctor:{doctorId}:{slotTimestamp}`.
- Two-phase availability verification against internal database and external EHR.
- Atomic database commit preventing race conditions between concurrent telephone and web callers.
