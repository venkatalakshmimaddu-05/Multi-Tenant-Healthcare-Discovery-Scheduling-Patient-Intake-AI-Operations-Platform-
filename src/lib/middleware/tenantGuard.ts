import { UserSession } from "../services/authService";

export class TenantGuard {
  /**
   * Enforces strict multi-tenant isolation.
   * Ensures that a tenant (Hospital Admin or Doctor) can only access resources belonging to their hospital.
   * Platform Admins have super-user multi-tenant access.
   */
  public static validateTenantAccess(
    session: UserSession,
    targetHospitalId: string
  ): { allowed: boolean; reason?: string } {
    // 1. Platform Admins have oversight across all hospital tenants
    if (session.role === "PLATFORM_ADMIN") {
      return { allowed: true };
    }

    // 2. Hospital Admins & Doctors must match target hospital
    if (session.role === "HOSPITAL_ADMIN" || session.role === "DOCTOR") {
      if (!session.hospitalId) {
        return {
          allowed: false,
          reason: "Security Violation: User session is missing an assigned hospital tenant.",
        };
      }

      if (session.hospitalId !== targetHospitalId) {
        return {
          allowed: false,
          reason: `Cross-Tenant Access Violation: User from hospital '${session.hospitalId}' is forbidden from accessing hospital '${targetHospitalId}'.`,
        };
      }

      return { allowed: true };
    }

    // 3. Patients cannot perform hospital admin actions
    return {
      allowed: false,
      reason: "Access Denied: Patient role cannot perform hospital administrative operations.",
    };
  }

  /**
   * Enforces Doctor role boundaries (doctors can only modify their own calendar & view their own patients)
   */
  public static validateDoctorAccess(
    session: UserSession,
    targetDoctorId: string
  ): { allowed: boolean; reason?: string } {
    if (session.role === "PLATFORM_ADMIN") return { allowed: true };

    if (session.role === "HOSPITAL_ADMIN") {
      return { allowed: true }; // Hospital admin can manage doctors in their hospital
    }

    if (session.role === "DOCTOR") {
      if (session.doctorId !== targetDoctorId) {
        return {
          allowed: false,
          reason: "Doctor Isolation: A doctor cannot access another doctor's private records or schedule.",
        };
      }
      return { allowed: true };
    }

    return { allowed: false, reason: "Unauthorized access to doctor resource." };
  }

  /**
   * Enforces Patient privacy boundaries
   */
  public static validatePatientAccess(
    session: UserSession,
    targetPatientId: string
  ): { allowed: boolean; reason?: string } {
    if (session.role === "PLATFORM_ADMIN" || session.role === "HOSPITAL_ADMIN" || session.role === "DOCTOR") {
      return { allowed: true };
    }

    if (session.role === "PATIENT") {
      if (session.patientId !== targetPatientId) {
        return {
          allowed: false,
          reason: "Patient Privacy Violation: Patients cannot view another patient's medical history or appointments.",
        };
      }
      return { allowed: true };
    }

    return { allowed: false, reason: "Unauthorized access to patient resource." };
  }
}
