import { prisma } from "../prisma";
import { AuditService } from "./auditService";
import { NotificationService } from "./notificationService";

export class WorkflowEngine {
  public static async trigger(event: string, payload: {
    appointmentId?: string;
    hospitalId?: string;
    patientId?: string;
    doctorId?: string;
    correlationId: string;
    data?: Record<string, any>;
  }): Promise<void> {
    console.log(`[WorkflowEngine] Triggered event: ${event} for appointment: ${payload.appointmentId}`);

    try {
      // 1. Audit event recording
      await AuditService.record({
        correlationId: payload.correlationId,
        hospitalId: payload.hospitalId,
        actorRole: "SYSTEM",
        action: `WORKFLOW_TRIGGERED_${event}`,
        entityType: "WORKFLOW",
        entityId: payload.appointmentId,
        details: { event, ...payload.data },
      });

      // 2. Handle APPOINTMENT_BOOKED
      if (event === "APPOINTMENT_BOOKED" && payload.appointmentId) {
        const appointment = await prisma.appointment.findUnique({
          where: { id: payload.appointmentId },
          include: {
            patient: true,
            doctor: { include: { specialty: true } },
            hospital: true,
          },
        });

        if (!appointment) return;

        // Auto-assign Pre-Visit Questionnaire if one matches doctor's specialty or hospital
        const questionnaire = await prisma.questionnaire.findFirst({
          where: {
            hospitalId: appointment.hospitalId,
            OR: [
              { specialtyId: appointment.doctor.specialtyId },
              { specialtyId: null },
            ],
          },
        });

        // Create Workflow Execution Record
        const matchedWorkflow = await prisma.workflow.findFirst({
          where: { hospitalId: appointment.hospitalId, triggerEvent: "APPOINTMENT_BOOKED" },
        });

        if (matchedWorkflow) {
          await prisma.workflowExecution.create({
            data: {
              workflowId: matchedWorkflow.id,
              appointmentId: appointment.id,
              status: "COMPLETED",
              executionLog: JSON.stringify({
                step1: "Patient notification sent via Voice SMS",
                step2: questionnaire ? `Assigned questionnaire: ${questionnaire.title}` : "No questionnaire matched",
                step3: "Doctor calendar updated",
                timestamp: new Date().toISOString(),
              }),
            },
          });
        }

        // Send confirmation notification
        const formattedDate = new Date(appointment.startTime).toLocaleString("en-US", {
          dateStyle: "full",
          timeStyle: "short",
        });

        await NotificationService.sendSms({
          correlationId: payload.correlationId,
          recipientType: "PATIENT",
          recipientPhone: appointment.patient.phone,
          subject: "Appointment Confirmed",
          message: `Hello ${appointment.patient.name}, your appointment with ${appointment.doctor.name} at ${appointment.hospital.name} is confirmed for ${formattedDate}. Please complete your pre-visit questionnaire.`,
        });

        // Doctor notification
        await prisma.notification.create({
          data: {
            correlationId: payload.correlationId,
            recipientType: "DOCTOR",
            recipientContact: appointment.doctor.name,
            channel: "IN_APP",
            subject: "New Booking Notification",
            message: `Patient ${appointment.patient.name} has scheduled an appointment on ${formattedDate}.`,
            status: "SENT",
          },
        });
      }

      // 3. Handle APPOINTMENT_CANCELLED
      if (event === "APPOINTMENT_CANCELLED" && payload.appointmentId) {
        const appointment = await prisma.appointment.findUnique({
          where: { id: payload.appointmentId },
          include: { patient: true, doctor: true },
        });
        if (appointment) {
          await prisma.notification.create({
            data: {
              correlationId: payload.correlationId,
              recipientType: "PATIENT",
              recipientContact: appointment.patient.phone,
              channel: "VOICE_SMS",
              subject: "Appointment Cancelled",
              message: `Your appointment with ${appointment.doctor.name} has been cancelled successfully.`,
              status: "SENT",
            },
          });
        }
      }

      // 4. Handle RECONCILIATION_REQUIRED
      if (event === "RECONCILIATION_REQUIRED") {
        await prisma.notification.create({
          data: {
            correlationId: payload.correlationId,
            recipientType: "HOSPITAL_ADMIN",
            recipientContact: "operator@metrohealth.org",
            channel: "IN_APP",
            subject: "URGENT: Appointment Synchronization Failed",
            message: `Correlation ${payload.correlationId}: EHR failed after retries. Manual reconciliation required.`,
            status: "SENT",
          },
        });
      }
    } catch (err) {
      console.error("[WorkflowEngine] Error processing workflow:", err);
    }
  }
}