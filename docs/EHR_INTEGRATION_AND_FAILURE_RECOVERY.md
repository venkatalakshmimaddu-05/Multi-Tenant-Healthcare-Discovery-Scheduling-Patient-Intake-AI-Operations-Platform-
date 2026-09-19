# Healthcare-System / EHR Integration & Fault Recovery

## 1. Architecture & Pluggable Connector Pattern

In healthcare IT, clinical providers operate heterogeneous Electronic Health Record (EHR) systems (e.g. Epic, Cerner, AthenaHealth, FHIR R4). The platform shields core application logic from vendor-specific protocols using an Adapter / Connector pattern:

```typescript
export interface EhrConnectorInterface {
  createAppointment(req: EhrAppointmentRequest): Promise<EhrAppointmentResponse>;
  verifyAppointment(externalAppointmentId: string, correlationId: string): Promise<boolean>;
  cancelAppointment(externalAppointmentId: string, correlationId: string): Promise<boolean>;
  lookupPatient(internalPatientId: string): Promise<string | null>;
  lookupProvider(internalDoctorId: string): Promise<string | null>;
}
```

### Identifier Mappings (`ExternalMapping`)
The platform persists bidirectional mappings between internal platform entities and external vendor systems:
- `Internal Patient` $\leftrightarrow$ `External Patient ID` (e.g. `EXT-PAT-9001`)
- `Internal Doctor` $\leftrightarrow$ `External Provider ID` (e.g. `EXT-PROV-101`)
- `Internal Facility` $\leftrightarrow$ `External Facility ID` (e.g. `EXT-FAC-001`)
- `Internal Appointment` $\leftrightarrow$ `External Appointment ID` (e.g. `EHR-APT-XYZ`)

---

## 2. PRD Section 28: Required Failure Demonstrations & Recovery

### Option A: EHR Timeout & Automatic Idempotent Recovery
- **Failure Trigger**: Network connection to the remote EHR cluster exceeds the 3000ms SLA, producing an `HTTP 504 Gateway Timeout`.
- **Classification**: The platform classifies the failure as `RETRYABLE_TIMEOUT`.
- **Recovery Policy**:
  1. System generates a retry attempt preserving the original `idempotencyKey` and `correlationId`.
  2. The connector writes the appointment safely.
  3. The verification loop checks the record directly against the external EHR.
  4. Internal appointment status synchronizes to `CONFIRMED`.

### Option B: Unknown Outcome Recovery (Packet Loss After Write)
- **Failure Trigger**: The remote EHR creates the appointment record, but a network socket hangup drops the response before the platform receives confirmation.
- **Problem**: Blindly retrying could create a **duplicate booking** in the clinical system.
- **Recovery Policy**:
  1. Rather than dispatching a duplicate create request, the recovery engine queries the EHR using the `idempotencyKey`.
  2. The EHR confirms that `EHR-APT-...` was already created.
  3. Internal status synchronizes directly to `CONFIRMED` without duplicate creation.

### Option C: Unrecoverable Outage & Human Escalation
- **Failure Trigger**: The external EHR is completely unreachable (`HTTP 503 Service Unavailable`), and all exponential retries are exhausted.
- **Problem**: The system cannot confirm the booking externally, but must not silently lose the patient's request.
- **Recovery Policy**:
  1. Internal appointment is flagged as `RECONCILIATION_REQUIRED`.
  2. A persistent `ReconciliationRecord` is written with status `PENDING_REVIEW` containing snapshots of the intended transaction.
  3. An urgent notification is dispatched to hospital operators.
  4. The record surfaces immediately on the Platform Admin and Hospital Admin dashboards for manual clinical triage.

---

## 3. Interactive Fault Injection Panel

Evaluators can test and observe any of these failure paths live directly from the top navigation bar or the Platform Admin portal by switching the **EHR Mode** dropdown:
- `🟢 Normal`: Instant synchronous success and external verification.
- `🟡 Option A`: Simulates 504 Gateway Timeout, logs failure classification, and demonstrates automated retry recovery.
- `🔵 Option B`: Simulates unknown outcome network drop, queries EHR, and demonstrates duplicate prevention.
- `🔴 Option C`: Simulates external outage, creates reconciliation record, and escalates to human triage.