import { prisma } from "../prisma";
import { EhrAppointmentRequest, EhrAppointmentResponse, EhrSimulationMode } from "../types";
import { AuditService } from "./auditService";
import { MetricsService } from "./metricsService";
import { v4 as uuidv4 } from "uuid";

// EHR Connector Interface
export interface EhrConnectorInterface {
  createAppointment(req: EhrAppointmentRequest): Promise<EhrAppointmentResponse>;
  verifyAppointment(externalAppointmentId: string, correlationId: string): Promise<boolean>;
  cancelAppointment(externalAppointmentId: string, correlationId: string): Promise<boolean>;
  lookupPatient(internalPatientId: string): Promise<string | null>;
  lookupProvider(internalDoctorId: string): Promise<string | null>;
}

// In-Memory store for Mock EHR external records
interface MockEhrRecord {
  externalAppointmentId: string;
  internalAppointmentId: string;
  externalPatientId: string;
  externalProviderId: string;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "CANCELLED";
  idempotencyKey: string;
}

export class MockEhrService implements EhrConnectorInterface {
  private static instance: MockEhrService;
  private static externalDatabase: Map<string, MockEhrRecord> = new Map();
  private static simulationMode: EhrSimulationMode = "NORMAL";

  public static getInstance(): MockEhrService {
    if (!MockEhrService.instance) {
      MockEhrService.instance = new MockEhrService();
    }
    return MockEhrService.instance;
  }

  public static setSimulationMode(mode: EhrSimulationMode) {
    MockEhrService.simulationMode = mode;
    console.log(`[MockEhrService] Simulation mode set to: ${mode}`);
  }

  public static getSimulationMode(): EhrSimulationMode {
    return MockEhrService.simulationMode;
  }

  public async lookupPatient(internalPatientId: string): Promise<string | null> {
    const mapping = await prisma.externalMapping.findFirst({
      where: { entityType: "PATIENT", internalId: internalPatientId },
    });
    return mapping?.externalId ?? `EXT-PAT-${internalPatientId.substring(0, 6)}`;
  }

  public async lookupProvider(internalDoctorId: string): Promise<string | null> {
    const mapping = await prisma.externalMapping.findFirst({
      where: { entityType: "DOCTOR", internalId: internalDoctorId },
    });
    return mapping?.externalId ?? `EXT-PROV-${internalDoctorId.substring(0, 6)}`;
  }

  /**
   * Main createAppointment implementation covering Option A, Option B, and Option C
   */
  public async createAppointment(req: EhrAppointmentRequest): Promise<EhrAppointmentResponse> {
    const startTimeMs = Date.now();
    const mode = MockEhrService.simulationMode;

    // Idempotency check in EHR
    for (const record of Array.from(MockEhrService.externalDatabase.values())) {
      if (record.idempotencyKey === req.idempotencyKey) {
        console.log(`[MockEhrService] Idempotent request hit for key: ${req.idempotencyKey}`);
        return {
          success: true,
          externalAppointmentId: record.externalAppointmentId,
          externalPatientId: record.externalPatientId,
          externalProviderId: record.externalProviderId,
          status: record.status,
        };
      }
    }

    const externalPatientId = (await this.lookupPatient(req.internalPatientId)) || "EXT-PAT-9001";
    const externalProviderId = (await this.lookupProvider(req.internalDoctorId)) || "EXT-PROV-101";
    const newExternalAptId = `EHR-APT-${Date.now().toString(36).toUpperCase()}`;

    // SCENARIO 1: NORMAL MODE
    if (mode === "NORMAL") {
      MockEhrService.externalDatabase.set(newExternalAptId, {
        externalAppointmentId: newExternalAptId,
        internalAppointmentId: req.internalAppointmentId,
        externalPatientId,
        externalProviderId,
        startTime: req.startTime,
        endTime: req.endTime,
        status: "CONFIRMED",
        idempotencyKey: req.idempotencyKey,
      });

      await this.logOperation({
        correlationId: req.correlationId,
        operationType: "CREATE_APPOINTMENT",
        status: "SUCCESS",
        requestPayload: req,
        responsePayload: { externalAppointmentId: newExternalAptId, status: "CONFIRMED" },
        durationMs: Date.now() - startTimeMs,
      });

      return {
        success: true,
        externalAppointmentId: newExternalAptId,
        externalPatientId,
        externalProviderId,
        status: "CONFIRMED",
      };
    }

    // SCENARIO 2: OPTION A - EHR TIMEOUT (Network drop with auto-retry recovery)
    if (mode === "TIMEOUT") {
      await this.logOperation({
        correlationId: req.correlationId,
        operationType: "CREATE_APPOINTMENT",
        status: "TIMEOUT",
        requestPayload: req,
        errorDetails: "HTTP 504 Gateway Timeout: External EHR did not respond within 3000ms",
        durationMs: 3100,
        retryCount: 0,
      });

      // Execute Option A Recovery: Failure Classification -> Retry with exponential backoff -> External Verification
      console.log(`[EHR Recovery] Option A triggered. Classifying failure as RETRYABLE_TIMEOUT...`);
      await AuditService.record({
        correlationId: req.correlationId,
        actorRole: "SYSTEM",
        action: "EHR_TIMEOUT_DETECTED",
        entityType: "EHR_RECORD",
        details: { mode: "TIMEOUT", isRetryable: true, willRetry: true },
      });

      // Simulate retry attempt
      console.log(`[EHR Recovery] Retrying operation with idempotency key ${req.idempotencyKey}...`);
      MockEhrService.externalDatabase.set(newExternalAptId, {
        externalAppointmentId: newExternalAptId,
        internalAppointmentId: req.internalAppointmentId,
        externalPatientId,
        externalProviderId,
        startTime: req.startTime,
        endTime: req.endTime,
        status: "CONFIRMED",
        idempotencyKey: req.idempotencyKey,
      });

      await this.logOperation({
        correlationId: req.correlationId,
        operationType: "CREATE_APPOINTMENT",
        status: "RETRIED",
        requestPayload: req,
        responsePayload: { externalAppointmentId: newExternalAptId, recovered: true },
        durationMs: 450,
        retryCount: 1,
      });

      return {
        success: true,
        externalAppointmentId: newExternalAptId,
        externalPatientId,
        externalProviderId,
        status: "CONFIRMED",
      };
    }

    // SCENARIO 3: OPTION B - UNKNOWN OUTCOME (Dropped packet after write; must query EHR directly to prevent duplicate)
    if (mode === "UNKNOWN_OUTCOME") {
      // The EHR *did* write the record
      MockEhrService.externalDatabase.set(newExternalAptId, {
        externalAppointmentId: newExternalAptId,
        internalAppointmentId: req.internalAppointmentId,
        externalPatientId,
        externalProviderId,
        startTime: req.startTime,
        endTime: req.endTime,
        status: "CONFIRMED",
        idempotencyKey: req.idempotencyKey,
      });

      // But client got a network drop (unknown outcome)
      await this.logOperation({
        correlationId: req.correlationId,
        operationType: "CREATE_APPOINTMENT",
        status: "TIMEOUT",
        requestPayload: req,
        errorDetails: "Network socket hang up after transmission. Outcome unknown.",
        durationMs: 2500,
      });

      console.log(`[EHR Recovery] Option B triggered: Querying EHR to see if appointment was created...`);
      // Step: Query EHR to check if created
      const foundRecord = Array.from(MockEhrService.externalDatabase.values()).find(
        (r) => r.idempotencyKey === req.idempotencyKey
      );

      if (foundRecord) {
        console.log(`[EHR Recovery] Found existing EHR record ${foundRecord.externalAppointmentId}. Synchronizing state without duplicate creation!`);
        await AuditService.record({
          correlationId: req.correlationId,
          actorRole: "SYSTEM",
          action: "EHR_UNKNOWN_OUTCOME_RESOLVED",
          entityType: "EHR_RECORD",
          entityId: foundRecord.externalAppointmentId,
          details: { outcome: "FOUND_EXISTING", duplicatePrevented: true },
        });

        await this.logOperation({
          correlationId: req.correlationId,
          operationType: "VERIFY_APPOINTMENT",
          status: "RECONCILED",
          responsePayload: { verified: true, record: foundRecord },
          durationMs: 120,
        });

        return {
          success: true,
          externalAppointmentId: foundRecord.externalAppointmentId,
          externalPatientId,
          externalProviderId,
          status: "CONFIRMED",
        };
      }
    }

    // SCENARIO 4: OPTION C - UNRECOVERABLE FAILURE (EHR Outage -> Retries Exhausted -> Human Escalation)
    if (mode === "OUTAGE") {
      await this.logOperation({
        correlationId: req.correlationId,
        operationType: "CREATE_APPOINTMENT",
        status: "FAILED",
        requestPayload: req,
        errorDetails: "HTTP 503 Service Unavailable: Remote EHR Cluster Unreachable after 3 retries",
        retryCount: 3,
        durationMs: 5200,
      });

      // Create Reconciliation Record
      await prisma.reconciliationRecord.create({
        data: {
          correlationId: req.correlationId,
          appointmentId: req.internalAppointmentId,
          reason: "EHR cluster unreachable (HTTP 503). Retries exhausted. Requires human operator synchronization.",
          status: "PENDING_REVIEW",
          internalData: JSON.stringify(req),
          externalData: JSON.stringify({ error: "HTTP 503 Outage" }),
        },
      });

      await AuditService.record({
        correlationId: req.correlationId,
        actorRole: "SYSTEM",
        action: "EHR_UNRECOVERABLE_FAILURE_ESCALATED",
        entityType: "APPOINTMENT",
        entityId: req.internalAppointmentId,
        details: { status: "RECONCILIATION_REQUIRED", reason: "Retries exhausted" },
      });

      return {
        success: false,
        status: "FAILED",
        error: "EHR integration failure. Appointment flagged for operational reconciliation.",
        isRetryable: false,
      };
    }

    return {
      success: true,
      externalAppointmentId: newExternalAptId,
      status: "CONFIRMED",
    };
  }

  public async verifyAppointment(externalAppointmentId: string, correlationId: string): Promise<boolean> {
    const record = MockEhrService.externalDatabase.get(externalAppointmentId);
    const verified = record !== undefined && record.status === "CONFIRMED";

    await this.logOperation({
      correlationId,
      operationType: "VERIFY_APPOINTMENT",
      status: verified ? "SUCCESS" : "FAILED",
      requestPayload: { externalAppointmentId },
      responsePayload: { verified },
      durationMs: 40,
    });

    return verified;
  }

  public async cancelAppointment(externalAppointmentId: string, correlationId: string): Promise<boolean> {
    const record = MockEhrService.externalDatabase.get(externalAppointmentId);
    if (record) {
      record.status = "CANCELLED";
    }

    await this.logOperation({
      correlationId,
      operationType: "CANCEL_APPOINTMENT",
      status: "SUCCESS",
      requestPayload: { externalAppointmentId },
      durationMs: 50,
    });

    return true;
  }

  private async logOperation(data: {
    correlationId: string;
    operationType: string;
    status: string;
    requestPayload?: any;
    responsePayload?: any;
    errorDetails?: string;
    retryCount?: number;
    durationMs?: number;
  }) {
    await prisma.integrationOperation.create({
      data: {
        correlationId: data.correlationId,
        operationType: data.operationType,
        status: data.status,
        requestPayload: data.requestPayload ? JSON.stringify(data.requestPayload) : null,
        responsePayload: data.responsePayload ? JSON.stringify(data.responsePayload) : null,
        errorDetails: data.errorDetails ?? null,
        retryCount: data.retryCount ?? 0,
        durationMs: data.durationMs ?? 0,
      },
    });
  }
}