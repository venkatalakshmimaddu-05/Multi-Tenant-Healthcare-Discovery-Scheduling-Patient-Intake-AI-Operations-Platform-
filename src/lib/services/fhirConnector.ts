import { prisma } from "../prisma";

export interface FhirResource {
  resourceType: string;
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    source?: string;
  };
  [key: string]: any;
}

export class FhirConnector {
  /**
   * Converts an internal AuraCare Appointment into a standard HL7 FHIR R4 Appointment resource
   */
  public static toFhirAppointment(appt: any): FhirResource {
    const fhirStatusMap: Record<string, string> = {
      CONFIRMED: "booked",
      PENDING: "pending",
      RESCHEDULED: "booked",
      CANCELLED: "cancelled",
      COMPLETED: "fulfilled",
      NO_SHOW: "noshow",
      FAILED: "cancelled",
    };

    return {
      resourceType: "Appointment",
      id: appt.id,
      meta: {
        versionId: "1",
        lastUpdated: appt.updatedAt ? new Date(appt.updatedAt).toISOString() : new Date().toISOString(),
        source: "urn:auracare:ehr:integration",
      },
      identifier: [
        {
          system: "urn:auracare:appointment-id",
          value: appt.id,
        },
        ...(appt.externalAppointmentId
          ? [
              {
                system: "urn:external:ehr-appointment-id",
                value: appt.externalAppointmentId,
              },
            ]
          : []),
      ],
      status: fhirStatusMap[appt.status] || "booked",
      serviceCategory: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/service-category",
              code: "general-practice",
              display: appt.doctor?.specialty?.name || "General Medicine",
            },
          ],
        },
      ],
      description: `Outpatient consultation with ${appt.doctor?.name || "Doctor"}`,
      start: new Date(appt.startTime).toISOString(),
      end: new Date(appt.endTime).toISOString(),
      created: appt.createdAt ? new Date(appt.createdAt).toISOString() : new Date().toISOString(),
      participant: [
        {
          actor: {
            reference: `Patient/${appt.patientId}`,
            display: appt.patient?.name || "Patient",
          },
          status: "accepted",
          required: "required",
        },
        {
          actor: {
            reference: `Practitioner/${appt.doctorId}`,
            display: appt.doctor?.name || "Doctor",
          },
          status: "accepted",
          required: "required",
        },
        {
          actor: {
            reference: `Location/${appt.hospitalId}`,
            display: appt.hospital?.name || "Hospital Facility",
          },
          status: "accepted",
        },
      ],
    };
  }

  /**
   * Converts an internal Patient into HL7 FHIR R4 Patient resource
   */
  public static toFhirPatient(patient: any): FhirResource {
    const nameParts = (patient.name || "Alex Morgan").split(" ");
    const family = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
    const given = nameParts.slice(0, -1);

    return {
      resourceType: "Patient",
      id: patient.id,
      active: true,
      name: [
        {
          use: "official",
          family,
          given: given.length > 0 ? given : [family],
        },
      ],
      telecom: [
        { system: "phone", value: patient.phone, use: "mobile" },
        { system: "email", value: patient.email, use: "home" },
      ],
    };
  }

  /**
   * Generates a complete HL7 FHIR R4 Transaction Bundle for an appointment
   */
  public static async generateAppointmentBundle(appointmentId: string): Promise<any> {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: { include: { specialty: true } },
        hospital: true,
      },
    });

    if (!appt) return null;

    const fhirAppt = this.toFhirAppointment(appt);
    const fhirPatient = this.toFhirPatient(appt.patient);

    return {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      total: 2,
      entry: [
        { fullUrl: `urn:uuid:${appt.id}`, resource: fhirAppt },
        { fullUrl: `urn:uuid:${appt.patientId}`, resource: fhirPatient },
      ],
    };
  }
}
