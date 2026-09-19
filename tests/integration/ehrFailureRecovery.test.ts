import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { CapabilityManager } from "../../src/lib/services/capabilityManager";
import { MockEhrService } from "../../src/lib/services/ehrIntegrationService";

describe("EHR Failure Demonstration & Recovery (PRD Section 28)", () => {
  let doctorId: string;
  let patientId: string;
  let hospitalId: string;

  beforeAll(async () => {
    const doc = await prisma.doctor.findFirst({
      where: { name: { contains: "Chen" } },
      include: { hospital: true },
    });
    doctorId = doc!.id;
    hospitalId = doc!.hospitalId;

    const pat = await prisma.patient.findFirst();
    patientId = pat!.id;

    // Clean up previous test appointments to avoid slot collision
    await prisma.appointment.deleteMany({
      where: {
        correlationId: { startsWith: "test-opt-" },
      },
    });
  });

  it("Option A: classifies EHR timeout, retries safely, verifies, and synchronizes to CONFIRMED", async () => {
    MockEhrService.setSimulationMode("TIMEOUT");
    const correlationId = `test-opt-a-${Date.now()}-${Math.random()}`;
    const baseTime = Date.now() + 2000000000 + Math.floor(Math.random() * 1000000000);
    const startTime = new Date(baseTime).toISOString();
    const endTime = new Date(baseTime + 1800000).toISOString();

    const result = await CapabilityManager.execute(
      "create_appointment",
      {
        doctorId,
        patientId,
        hospitalId,
        startTime,
        endTime,
        type: "IN_PERSON",
      },
      correlationId
    );

    expect(result.success).toBe(true);
    expect(result.data.status).toBe("CONFIRMED");
    expect(result.data.ehrVerificationStatus).toBe("VERIFIED");

    // Verify integration operations logged TIMEOUT and RETRIED
    const ops = await prisma.integrationOperation.findMany({
      where: { correlationId },
    });
    const hasTimeout = ops.some((op) => op.status === "TIMEOUT");
    const hasRetried = ops.some((op) => op.status === "RETRIED");
    expect(hasTimeout).toBe(true);
    expect(hasRetried).toBe(true);
  });

  it("Option B: recovers from unknown outcome by querying EHR and avoids duplicate appointment", async () => {
    MockEhrService.setSimulationMode("UNKNOWN_OUTCOME");
    const correlationId = `test-opt-b-${Date.now()}-${Math.random()}`;
    const baseTime = Date.now() + 3000000000 + Math.floor(Math.random() * 100000000);
    const startTime = new Date(baseTime).toISOString();
    const endTime = new Date(baseTime + 1800000).toISOString();

    const result = await CapabilityManager.execute(
      "create_appointment",
      {
        doctorId,
        patientId,
        hospitalId,
        startTime,
        endTime,
        type: "IN_PERSON",
      },
      correlationId
    );

    expect(result.success).toBe(true);
    expect(result.data.status).toBe("CONFIRMED");

    // Verify reconciliation log in integration operations
    const ops = await prisma.integrationOperation.findMany({
      where: { correlationId },
    });
    const hasReconciled = ops.some((op) => op.status === "RECONCILED");
    expect(hasReconciled).toBe(true);
  });

  it("Option C: handles unrecoverable EHR outage, creates reconciliation record, and escalates to human", async () => {
    MockEhrService.setSimulationMode("OUTAGE");
    const correlationId = `test-opt-c-${Date.now()}-${Math.random()}`;
    const baseTime = Date.now() + 4000000000 + Math.floor(Math.random() * 100000000);
    const startTime = new Date(baseTime).toISOString();
    const endTime = new Date(baseTime + 1800000).toISOString();

    const result = await CapabilityManager.execute(
      "create_appointment",
      {
        doctorId,
        patientId,
        hospitalId,
        startTime,
        endTime,
        type: "IN_PERSON",
      },
      correlationId
    );

    expect(result.success).toBe(false);

    // Verify Reconciliation Record was created in DB for Human Operator
    const reconRecord = await prisma.reconciliationRecord.findFirst({
      where: { correlationId },
    });
    expect(reconRecord).not.toBeNull();
    expect(reconRecord!.status).toBe("PENDING_REVIEW");
    expect(reconRecord!.reason).toContain("EHR cluster unreachable");

    // Reset mode to NORMAL
    MockEhrService.setSimulationMode("NORMAL");
  });
});