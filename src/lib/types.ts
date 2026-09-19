export type CapabilityName =
  | "search_hospitals"
  | "search_doctors"
  | "check_availability"
  | "lookup_patient"
  | "get_appointment"
  | "create_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "get_questionnaire"
  | "submit_questionnaire"
  | "send_notification"
  | "start_workflow"
  | "get_context"
  | "update_preferences"
  | "verify_external_appointment"
  | "synchronize_state"
  | "transfer_to_human";

export type EhrSimulationMode =
  | "NORMAL"           // Fast, deterministic success
  | "TIMEOUT"          // Option A: Times out, then retry recovers & verifies
  | "UNKNOWN_OUTCOME"  // Option B: Drops response after writing to EHR; recovery verifies & avoids duplicates
  | "OUTAGE";          // Option C: Exhausts retries, flags reconciliation record, escalates to human

export interface EhrAppointmentRequest {
  internalAppointmentId: string;
  internalPatientId: string;
  internalDoctorId: string;
  hospitalId: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  type: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface EhrAppointmentResponse {
  success: boolean;
  externalAppointmentId?: string;
  externalPatientId?: string;
  externalProviderId?: string;
  status: "CONFIRMED" | "FAILED" | "PENDING" | "CONFLICT" | "CANCELLED";
  error?: string;
  isRetryable?: boolean;
}

export interface CapabilityResult<T = any> {
  success: boolean;
  capability: CapabilityName;
  correlationId: string;
  data?: T;
  error?: string;
  executionTimeMs: number;
}

export interface NluParseResult {
  intent:
    | "BOOK_APPOINTMENT"
    | "RESCHEDULE"
    | "CANCEL"
    | "CHECK_AVAILABILITY"
    | "INQUIRE_SPECIALTY"
    | "SUBMIT_INTAKE"
    | "GENERAL_ADMIN"
    | "CLINICAL_QUERY_REJECTED"
    | "CLARIFICATION_NEEDED"
    | "QUESTIONNAIRE_INFO"
    | "APPOINTMENT_STATUS"
    | "PORTAL_NAVIGATION"
    | "UNSUPPORTED_SPECIALTY"
    | "GRATITUDE";
  specialtyKeyword?: string;
  unsupportedSpecialty?: string;
  doctorName?: string;
  hospitalName?: string;
  timeframe?: string; // "Friday", "tomorrow", "next week", "morning"
  dateIso?: string;
  symptom?: string;
  appointmentId?: string;
  clarificationNeeded?: string;
  isClinicalViolation?: boolean;
  rejectedDay?: string;
  isRejectingSlotOrDay?: boolean;
  wantsAlternativeDay?: boolean;
}

export interface ConversationalState {
  conversationId: string;
  patientId: string;
  currentIntent?: string;
  selectedHospitalId?: string;
  selectedDoctorId?: string;
  selectedSlotTime?: string;
  selectedAppointmentId?: string;
  patientName?: string;
  patientPhone?: string;
  contextData: Record<string, any>;
}

export interface AvailableSlot {
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  formattedTime: string; // "10:00 AM"
  formattedDate: string; // "Friday, Oct 17"
  isAvailable: boolean;
}
