import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { CapabilityManager } from "../../src/lib/services/capabilityManager";
import { MockEhrService } from "../../src/lib/services/ehrIntegrationService";

describe("End-to-End Booking & Verification Flow", () => {
  let doctorId: string;
  let patientId: string;
  let hospitalId: string;

  beforeAll(async () => {
    MockEhrService.setSimulationMode("NORMAL");
    const doc = await prisma.doctor.findFirst({
      where: { name: { contains: "Rao" } },
      include: { hospital: true },
    });
    doctorId = doc!.id;
    hospitalId = doc!.hospitalId;

    const pat = await prisma.patient.findFirst();
    patientId = pat!.id;
  });

  it("executes booking, verifies with external EHR, and syncs internal state to CONFIRMED", async () => {
    const correlationId = `test-corr-${Date.now()}-${Math.random()}`;
    // Unique slot far in future (guaranteed non-colliding with previous runs)
    const uniqueFutureMs = Date.now() + 86400000 * (30 + Math.floor(Math.random() * 500));
    const startTime = new Date(uniqueFutureMs).toISOString();
    const endTime = new Date(uniqueFutureMs + 1800000).toISOString();

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
    expect(result.data).toBeDefined();
    expect(result.data.status).toBe("CONFIRMED");
    expect(result.data.ehrVerificationStatus).toBe("VERIFIED");
    expect(result.data.externalAppointmentId).toMatch(/^EHR-APT-/);

    // Verify database record
    const saved = await prisma.appointment.findUnique({
      where: { id: result.data.id },
      include: { workflowExecutions: true },
    });

    expect(saved).not.toBeNull();
    expect(saved!.status).toBe("CONFIRMED");
    expect(saved!.correlationId).toBe(correlationId);

    // Verify workflow was triggered
    expect(saved!.workflowExecutions.length).toBeGreaterThan(0);

    // Verify notifications were dispatched
    const notifs = await prisma.notification.findMany({
      where: { correlationId },
    });
    expect(notifs.length).toBeGreaterThan(0);
  });
});