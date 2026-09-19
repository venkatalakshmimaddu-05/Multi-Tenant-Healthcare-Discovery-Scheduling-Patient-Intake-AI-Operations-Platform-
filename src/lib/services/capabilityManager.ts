import { prisma } from "../prisma";
import { CapabilityName, CapabilityResult } from "../types";
import { SchedulingService } from "./schedulingService";
import { MockEhrService } from "./ehrIntegrationService";
import { WorkflowEngine } from "./workflowEngine";
import { AuditService } from "./auditService";
import { MetricsService } from "./metricsService";
import { v4 as uuidv4 } from "uuid";

export class CapabilityManager {
  /**
   * Executes a controlled capability through a strictly validated and audited interface.
   * AI never accesses the database or EHR directly (PRD Section 9 & 10).
   */
  public static async execute(
    name: CapabilityName,
    params: Record<string, any>,
    correlationId: string,
    conversationId?: string
  ): Promise<CapabilityResult> {
    const startTimeMs = Date.now();
    let resultData: any = null;
    let errorMessage: string | undefined = undefined;
    let status = "SUCCESS";

    try {
      switch (name) {
        case "search_hospitals": {
          resultData = await prisma.hospital.findMany({
            where: {
              status: "APPROVED",
              ...(params.keyword
                ? {
                    OR: [
                      { name: { contains: params.keyword } },
                      { address: { contains: params.keyword } },
                    ],
                  }
                : {}),
            },
            include: {
              departments: true,
            },
          });
          break;
        }

        case "search_doctors": {
          const specQuery = (params.specialty || "").trim();
          const specialtyFilter = specQuery
            ? {
                specialty: {
                  OR: [
                    { name: { contains: specQuery } },
                    { symptomKeywords: { contains: specQuery.toLowerCase() } },
                    ...(/\b(?:ent|otolaryngolog|ear|throat|sinus)\b/i.test(specQuery)
                      ? [{ name: { contains: "ENT" } }, { name: { contains: "Otolaryngology" } }]
                      : []),
                    ...(/\b(?:eye|vision|ophthalmolog)\b/i.test(specQuery)
                      ? [{ name: { contains: "Ophthalmology" } }]
                      : []),
                    ...(/\b(?:brain|nerve|neurolog)\b/i.test(specQuery)
                      ? [{ name: { contains: "Neurology" } }]
                      : []),
                    ...(/\b(?:stomach|digest|gastro|gastroenterolog)\b/i.test(specQuery)
                      ? [{ name: { contains: "Gastroenterology" } }]
                      : []),
                    ...(/\b(?:child|pediatric|paediatric)\b/i.test(specQuery)
                      ? [{ name: { contains: "Pediatrics" } }]
                      : []),
                    ...(/\b(?:ortho|orthopedic|bone|joint|spine)\b/i.test(specQuery)
                      ? [{ name: { contains: "Orthopedics" } }]
                      : []),
                    ...(/\b(?:derma|dermatolog|skin|rash)\b/i.test(specQuery)
                      ? [{ name: { contains: "Dermatology" } }]
                      : []),
                    ...(/\b(?:cardio|cardiolog|heart)\b/i.test(specQuery)
                      ? [{ name: { contains: "Cardiology" } }]
                      : []),
                    ...(/\b(?:general|internal medicine|primary care|physician|gp)\b/i.test(specQuery)
                      ? [{ name: { contains: "General Medicine" } }]
                      : []),
                  ],
                },
              }
            : {};

          resultData = await prisma.doctor.findMany({
            where: {
              status: "ACTIVE",
              hospital: { status: "APPROVED" },
              ...(params.hospitalId ? { hospitalId: params.hospitalId } : {}),
              ...(params.name ? { name: { contains: params.name } } : {}),
              ...specialtyFilter,
            },
            include: {
              specialty: true,
              hospital: { select: { id: true, name: true, address: true } },
            },
          });
          break;
        }

        case "check_availability": {
          if (!params.doctorId) throw new Error("Missing required doctorId");
          const targetDate = params.date ? new Date(params.date) : new Date();
          resultData = await SchedulingService.getAvailableSlots(params.doctorId, targetDate);
          break;
        }

        case "lookup_patient": {
          if (params.id) {
            resultData = await prisma.patient.findUnique({ where: { id: params.id }, include: { contextPreferences: true } });
          } else if (params.email) {
            resultData = await prisma.patient.findUnique({ where: { email: params.email }, include: { contextPreferences: true } });
          } else if (params.phone) {
            resultData = await prisma.patient.findFirst({ where: { phone: params.phone }, include: { contextPreferences: true } });
          } else {
            // Default to first patient for quick demo/phone intake simulation
            resultData = await prisma.patient.findFirst({ include: { contextPreferences: true } });
          }
          break;
        }

        case "get_appointment": {
          if (!params.appointmentId) throw new Error("Missing appointmentId");
          resultData = await prisma.appointment.findUnique({
            where: { id: params.appointmentId },
            include: { doctor: { include: { specialty: true } }, hospital: true, patient: true },
          });
          break;
        }

        case "create_appointment": {
          const { doctorId, patientId, startTime, endTime, type = "IN_PERSON", hospitalId } = params;
          const idempotencyKey = params.idempotencyKey || `idemp-${Date.now()}-${uuidv4().substring(0, 6)}`;

          // Check idempotency first
          const existingIdempotent = await prisma.appointment.findUnique({
            where: { idempotencyKey },
            include: { doctor: true, hospital: true, patient: true },
          });
          if (existingIdempotent) {
            resultData = existingIdempotent;
            break;
          }

          // Step 1: Concurrency Mutex Lock
          const lockAcquired = SchedulingService.acquireLock(doctorId, startTime);
          if (!lockAcquired) {
            throw new Error("Concurrency Conflict: The requested slot is currently being reserved by another patient. Please choose another time.");
          }

          try {
            // Step 2: Re-validate real availability immediately before booking
            const isAvailable = await SchedulingService.isSlotStillAvailable(
              doctorId,
              new Date(startTime),
              new Date(endTime)
            );
            if (!isAvailable) {
              throw new Error("Slot Conflict: This appointment slot has just been booked. Please pick another available time.");
            }

            // Step 3: Create Internal Appointment record (status: SYNCHRONIZATION_PENDING)
            const targetHospitalId =
              hospitalId ||
              (await prisma.doctor.findUnique({ where: { id: doctorId } }))?.hospitalId;

            if (!targetHospitalId) throw new Error("Doctor not associated with any hospital");

            const appointment = await prisma.appointment.create({
              data: {
                hospitalId: targetHospitalId,
                doctorId,
                patientId,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                type,
                status: "SYNCHRONIZATION_PENDING",
                ehrVerificationStatus: "PENDING",
                idempotencyKey,
                correlationId,
              },
              include: { doctor: true, hospital: true, patient: true },
            });

            // Step 4: Healthcare-System / EHR Integration call
            const ehrService = MockEhrService.getInstance();
            const ehrResponse = await ehrService.createAppointment({
              internalAppointmentId: appointment.id,
              internalPatientId: patientId,
              internalDoctorId: doctorId,
              hospitalId: targetHospitalId,
              startTime,
              endTime,
              type,
              correlationId,
              idempotencyKey,
            });

            if (!ehrResponse.success) {
              // Unrecoverable or Outage
              await prisma.appointment.update({
                where: { id: appointment.id },
                data: {
                  status: "RECONCILIATION_REQUIRED",
                  ehrVerificationStatus: "RECONCILIATION_REQUIRED",
                },
              });
              await WorkflowEngine.trigger("RECONCILIATION_REQUIRED", {
                appointmentId: appointment.id,
                hospitalId: targetHospitalId,
                correlationId,
              });
              throw new Error(ehrResponse.error || "External EHR failed to confirm appointment.");
            }

            // Step 5: External Verification Loop
            const isVerified = await ehrService.verifyAppointment(
              ehrResponse.externalAppointmentId!,
              correlationId
            );

            if (!isVerified) {
              await prisma.appointment.update({
                where: { id: appointment.id },
                data: {
                  status: "RECONCILIATION_REQUIRED",
                  ehrVerificationStatus: "FAILED",
                },
              });
              throw new Error("EHR record verification failed after booking attempt.");
            }

            // Step 6: State Synchronization to CONFIRMED
            const confirmedAppointment = await prisma.appointment.update({
              where: { id: appointment.id },
              data: {
                status: "CONFIRMED",
                ehrVerificationStatus: "VERIFIED",
                externalAppointmentId: ehrResponse.externalAppointmentId,
              },
              include: { doctor: true, hospital: true, patient: true },
            });

            await prisma.appointmentHistory.create({
              data: {
                appointmentId: confirmedAppointment.id,
                fromStatus: "SYNCHRONIZATION_PENDING",
                toStatus: "CONFIRMED",
                reason: "EHR booking successfully verified & state synchronized",
                changedBy: "AI_AGENT",
              },
            });

            // Step 7: Trigger Post-Booking Workflows (Pre-visit questionnaire assignment & notifications)
            await WorkflowEngine.trigger("APPOINTMENT_BOOKED", {
              appointmentId: confirmedAppointment.id,
              hospitalId: targetHospitalId,
              patientId,
              doctorId,
              correlationId,
            });

            resultData = confirmedAppointment;
          } finally {
            SchedulingService.releaseLock(doctorId, startTime);
          }
          break;
        }

        case "reschedule_appointment": {
          const { appointmentId, newStartTime, newEndTime } = params;
          const appt = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { doctor: true },
          });
          if (!appt) throw new Error("Appointment not found");

          const isAvailable = await SchedulingService.isSlotStillAvailable(
            appt.doctorId,
            new Date(newStartTime),
            new Date(newEndTime)
          );
          if (!isAvailable) throw new Error("New slot is not available");

          const oldStatus = appt.status;
          const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
              startTime: new Date(newStartTime),
              endTime: new Date(newEndTime),
              status: "RESCHEDULED",
            },
            include: { doctor: true, hospital: true, patient: true },
          });

          await prisma.appointmentHistory.create({
            data: {
              appointmentId,
              fromStatus: oldStatus,
              toStatus: "RESCHEDULED",
              reason: params.reason || "Patient requested reschedule via AI Agent",
              changedBy: "AI_AGENT",
            },
          });

          await WorkflowEngine.trigger("APPOINTMENT_RESCHEDULED", {
            appointmentId,
            hospitalId: appt.hospitalId,
            correlationId,
          });

          resultData = updated;
          break;
        }

        case "cancel_appointment": {
          const { appointmentId, reason = "Patient requested cancellation" } = params;
          const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
          if (!appt) throw new Error("Appointment not found");

          const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: "CANCELLED" },
          });

          if (appt.externalAppointmentId) {
            await MockEhrService.getInstance().cancelAppointment(appt.externalAppointmentId, correlationId);
          }

          await prisma.appointmentHistory.create({
            data: {
              appointmentId,
              fromStatus: appt.status,
              toStatus: "CANCELLED",
              reason,
              changedBy: "AI_AGENT",
            },
          });

          await WorkflowEngine.trigger("APPOINTMENT_CANCELLED", {
            appointmentId,
            hospitalId: appt.hospitalId,
            correlationId,
          });

          resultData = updated;
          break;
        }

        case "get_questionnaire": {
          const { hospitalId, specialtyId, appointmentId } = params;
          let targetHospitalId = hospitalId;
          let targetSpecialtyId = specialtyId;

          if (appointmentId) {
            const appt = await prisma.appointment.findUnique({
              where: { id: appointmentId },
              include: { doctor: true },
            });
            if (appt) {
              targetHospitalId = appt.hospitalId;
              targetSpecialtyId = appt.doctor.specialtyId;
            }
          }

          let q = await prisma.questionnaire.findFirst({
            where: {
              ...(targetHospitalId ? { hospitalId: targetHospitalId } : {}),
              ...(targetSpecialtyId ? { OR: [{ specialtyId: targetSpecialtyId }, { specialtyId: null }] } : {}),
            },
            include: { specialty: true, hospital: true },
          });

          // Fallback: search by specialty across system
          if (!q && targetSpecialtyId) {
            q = await prisma.questionnaire.findFirst({
              where: { specialtyId: targetSpecialtyId },
              include: { specialty: true, hospital: true },
            });
          }

          // Fallback: general first questionnaire
          if (!q) {
            q = await prisma.questionnaire.findFirst({
              include: { specialty: true, hospital: true },
            });
          }

          resultData = q;
          break;
        }

        case "submit_questionnaire": {
          const { questionnaireId, appointmentId, patientId, responsesJson } = params;
          resultData = await prisma.questionnaireResponse.create({
            data: {
              questionnaireId,
              appointmentId,
              patientId,
              responsesJson: typeof responsesJson === "string" ? responsesJson : JSON.stringify(responsesJson),
            },
          });

          await AuditService.record({
            correlationId,
            actorRole: "PATIENT",
            action: "QUESTIONNAIRE_SUBMITTED",
            entityType: "QUESTIONNAIRE",
            entityId: questionnaireId,
            details: { appointmentId },
          });
          break;
        }

        case "get_context": {
          const { patientId } = params;
          resultData = await prisma.userContext.findUnique({ where: { patientId } });
          break;
        }

        case "update_preferences": {
          const { patientId, preferredDays, preferredTimeOfDay } = params;
          resultData = await prisma.userContext.upsert({
            where: { patientId },
            update: { preferredDays, preferredTimeOfDay },
            create: { patientId, preferredDays, preferredTimeOfDay },
          });
          break;
        }

        case "verify_external_appointment": {
          const { externalAppointmentId } = params;
          const isVerified = await MockEhrService.getInstance().verifyAppointment(
            externalAppointmentId,
            correlationId
          );
          resultData = { externalAppointmentId, isVerified };
          break;
        }

        case "synchronize_state": {
          const { appointmentId } = params;
          const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
          if (!appt) throw new Error("Appointment not found");
          resultData = { synchronized: true, appointment: appt };
          break;
        }

        case "transfer_to_human": {
          const { reason } = params;
          await AuditService.record({
            correlationId,
            actorRole: "AI_AGENT",
            action: "HUMAN_ESCALATION_TRIGGERED",
            entityType: "PATIENT",
            details: { reason },
          });
          resultData = {
            escalated: true,
            message: "You are being connected with a healthcare triage operator. Please hold the line.",
          };
          break;
        }

        case "send_notification": {
          resultData = await prisma.notification.create({
            data: {
              correlationId,
              recipientType: params.recipientType || "PATIENT",
              recipientContact: params.recipientContact || "User",
              channel: params.channel || "VOICE_SMS",
              subject: params.subject || "Platform Notification",
              message: params.message || "",
              status: "SENT",
            },
          });
          break;
        }

        case "start_workflow": {
          await WorkflowEngine.trigger(params.event || "CUSTOM_WORKFLOW", {
            correlationId,
            hospitalId: params.hospitalId,
            appointmentId: params.appointmentId,
          });
          resultData = { started: true };
          break;
        }

        default:
          throw new Error(`Unsupported capability: ${name}`);
      }
    } catch (err: any) {
      status = "EXECUTION_ERROR";
      errorMessage = err.message;
      console.error(`[CapabilityManager] Error executing ${name}:`, err);
    }

    const latencyMs = Date.now() - startTimeMs;

    // Record Capability Execution for AI Observability
    await prisma.capabilityExecution.create({
      data: {
        conversationId: conversationId ?? null,
        correlationId,
        capabilityName: name,
        inputPayload: JSON.stringify(params),
        outputPayload: resultData ? JSON.stringify(resultData) : null,
        status,
        latencyMs,
      },
    });

    // Record Operational Metric
    await MetricsService.record(`CAPABILITY_${name.toUpperCase()}`, 1, { status });

    if (errorMessage) {
      return {
        success: false,
        capability: name,
        correlationId,
        error: errorMessage,
        executionTimeMs: latencyMs,
      };
    }

    return {
      success: true,
      capability: name,
      correlationId,
      data: resultData,
      executionTimeMs: latencyMs,
    };
  }
}