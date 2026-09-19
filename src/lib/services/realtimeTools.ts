import { CapabilityManager } from "./capabilityManager";
import { AuditService } from "./auditService";

export interface RealtimeToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export const REALTIME_TOOLS: RealtimeToolDefinition[] = [
  {
    type: "function",
    name: "search_doctors",
    description: "Search for certified medical doctors by specialty, symptom keywords, or doctor name.",
    parameters: {
      type: "object",
      properties: {
        specialty: {
          type: "string",
          description: "Medical specialty such as Dermatology, Orthopedics, Cardiology, General Medicine",
        },
        name: {
          type: "string",
          description: "Doctor name, such as Dr. Sarah Patel, Dr. Ananya Rao, Dr. Marcus Chen, Dr. David Kim",
        },
      },
    },
  },
  {
    type: "function",
    name: "check_availability",
    description: "Check verified calendar availability slots for a doctor on a specific date.",
    parameters: {
      type: "object",
      properties: {
        doctorId: {
          type: "string",
          description: "The unique UUID of the doctor",
        },
        date: {
          type: "string",
          description: "Target date in ISO 8601 or natural date string (e.g. 2026-09-18, Friday, tomorrow)",
        },
      },
      required: ["doctorId"],
    },
  },
  {
    type: "function",
    name: "create_appointment",
    description: "Reserve a verified appointment slot, lock the concurrency mutex, synchronize with EHR, and return confirmation.",
    parameters: {
      type: "object",
      properties: {
        doctorId: { type: "string", description: "Doctor UUID" },
        patientId: { type: "string", description: "Patient UUID" },
        hospitalId: { type: "string", description: "Hospital UUID" },
        startTime: { type: "string", description: "Start time in ISO format (e.g. 2026-09-18T09:30:00.000Z)" },
        endTime: { type: "string", description: "End time in ISO format (e.g. 2026-09-18T10:00:00.000Z)" },
        type: { type: "string", enum: ["IN_PERSON", "TELEHEALTH"], description: "Consultation type" },
      },
      required: ["doctorId", "patientId", "hospitalId", "startTime", "endTime"],
    },
  },
  {
    type: "function",
    name: "get_questionnaire",
    description: "Retrieve the pre-visit clinical intake questionnaire assigned to an appointment or specialty for patient completion.",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "Appointment UUID" },
        hospitalId: { type: "string", description: "Hospital UUID" },
        specialtyId: { type: "string", description: "Specialty UUID" },
      },
    },
  },
  {
    type: "function",
    name: "cancel_appointment",
    description: "Cancel an existing confirmed appointment and release the reserved slot.",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "Appointment UUID to cancel" },
        reason: { type: "string", description: "Reason for cancellation" },
      },
      required: ["appointmentId"],
    },
  },
];

export async function executeRealtimeTool(
  name: string,
  args: Record<string, any>,
  correlationId?: string,
  conversationId?: string
) {
  const corrId = correlationId || AuditService.generateCorrelationId("rt-tool");
  return await CapabilityManager.execute(name as any, args, corrId, conversationId);
}
