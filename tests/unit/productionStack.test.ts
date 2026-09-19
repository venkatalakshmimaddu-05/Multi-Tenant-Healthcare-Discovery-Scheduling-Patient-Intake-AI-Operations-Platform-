import { describe, it, expect } from "vitest";
import { AuthService, UserSession } from "../../src/lib/services/authService";
import { TenantGuard } from "../../src/lib/middleware/tenantGuard";
import { RedisService } from "../../src/lib/services/redisService";
import { FhirConnector } from "../../src/lib/services/fhirConnector";
import { NotificationService } from "../../src/lib/services/notificationService";

describe("Production Stack Services & Security Tests", () => {
  // ----------------- Auth & JWT Tests -----------------
  describe("AuthService & Security", () => {
    it("hashes and verifies passwords securely using PBKDF2 with salt", () => {
      const password = "SuperSecretPassword123!";
      const { hash, salt } = AuthService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash.length).toBe(128); // 64 bytes hex = 128 chars

      // Successful verification
      const isValid = AuthService.verifyPassword(password, hash, salt);
      expect(isValid).toBe(true);

      // Incorrect password fails
      const isInvalid = AuthService.verifyPassword("WrongPassword", hash, salt);
      expect(isInvalid).toBe(false);
    });

    it("signs and verifies valid JWT tokens for user sessions", () => {
      const session: UserSession = {
        userId: "usr-doc-patel",
        email: "sarah.patel@citycare.org",
        name: "Dr. Sarah Patel",
        role: "DOCTOR",
        hospitalId: "hosp-city-care",
        doctorId: "doc-patel",
      };

      const token = AuthService.signToken(session, 1);
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);

      const decoded = AuthService.verifyToken(token);
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe("usr-doc-patel");
      expect(decoded?.role).toBe("DOCTOR");
      expect(decoded?.hospitalId).toBe("hosp-city-care");
    });

    it("rejects tampered or forged JWT tokens", () => {
      const session: UserSession = {
        userId: "usr-patient",
        email: "alex@example.com",
        name: "Alex Morgan",
        role: "PATIENT",
      };

      const token = AuthService.signToken(session, 1);
      // Tamper signature
      const tampered = token.slice(0, -5) + "abcde";
      const verified = AuthService.verifyToken(tampered);
      expect(verified).toBeNull();
    });

    it("authenticates credentials for the 4 core platform roles", async () => {
      // Platform Admin
      const adminAuth = await AuthService.authenticate("admin@auracare.com");
      expect(adminAuth.success).toBe(true);
      expect(adminAuth.session?.role).toBe("PLATFORM_ADMIN");

      // Hospital Admin
      const hospAuth = await AuthService.authenticate("admin@citycare.org");
      expect(hospAuth.success).toBe(true);
      expect(hospAuth.session?.role).toBe("HOSPITAL_ADMIN");

      // Doctor
      const docAuth = await AuthService.authenticate("sarah.patel@citycare.org");
      expect(docAuth.success).toBe(true);
      expect(docAuth.session?.role).toBe("DOCTOR");

      // Patient
      const patAuth = await AuthService.authenticate("alex.morgan@example.com");
      expect(patAuth.success).toBe(true);
      expect(patAuth.session?.role).toBe("PATIENT");
    });
  });

  // ----------------- Multi-Tenant Isolation Tests -----------------
  describe("TenantGuard (Multi-Tenancy Isolation)", () => {
    it("allows Hospital Admin to access their own hospital", () => {
      const session: UserSession = {
        userId: "admin-h1",
        email: "admin@hospitalA.com",
        name: "Hospital A Admin",
        role: "HOSPITAL_ADMIN",
        hospitalId: "hospital-A",
      };

      const result = TenantGuard.validateTenantAccess(session, "hospital-A");
      expect(result.allowed).toBe(true);
    });

    it("strictly forbids Hospital Admin A from accessing Hospital B (Cross-Tenant Violation)", () => {
      const session: UserSession = {
        userId: "admin-h1",
        email: "admin@hospitalA.com",
        name: "Hospital A Admin",
        role: "HOSPITAL_ADMIN",
        hospitalId: "hospital-A",
      };

      const result = TenantGuard.validateTenantAccess(session, "hospital-B");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Cross-Tenant Access Violation");
    });

    it("allows Platform Admin global access across all hospital tenants", () => {
      const session: UserSession = {
        userId: "platform-super",
        email: "admin@auracare.com",
        name: "Platform Director",
        role: "PLATFORM_ADMIN",
      };

      const resultA = TenantGuard.validateTenantAccess(session, "hospital-A");
      const resultB = TenantGuard.validateTenantAccess(session, "hospital-B");
      expect(resultA.allowed).toBe(true);
      expect(resultB.allowed).toBe(true);
    });

    it("enforces doctor isolation from accessing another doctor's private records", () => {
      const session: UserSession = {
        userId: "doc-1",
        email: "doc1@hospital.com",
        name: "Dr. Doctor One",
        role: "DOCTOR",
        hospitalId: "hospital-A",
        doctorId: "doc-1",
      };

      // Allowed for own records
      const ownResult = TenantGuard.validateDoctorAccess(session, "doc-1");
      expect(ownResult.allowed).toBe(true);

      // Blocked from another doctor's records
      const otherResult = TenantGuard.validateDoctorAccess(session, "doc-2");
      expect(otherResult.allowed).toBe(false);
      expect(otherResult.reason).toContain("Doctor Isolation");
    });
  });

  // ----------------- Redis Distributed Locking Tests -----------------
  describe("RedisService (Distributed Locks)", () => {
    it("acquires and releases distributed locks correctly", async () => {
      const testKey = `unit-test-slot-${Date.now()}`;

      // 1. Acquire lock
      const lock1 = await RedisService.acquireLock(testKey, 10000);
      expect(lock1.success).toBe(true);
      expect(lock1.lockId).toBeDefined();

      // 2. Concurrent second attempt on same resource must fail
      const lock2 = await RedisService.acquireLock(testKey, 10000);
      expect(lock2.success).toBe(false);
      expect(lock2.lockId).toBeNull();

      // 3. Release lock with valid lockId
      const released = await RedisService.releaseLock(testKey, lock1.lockId!);
      expect(released).toBe(true);

      // 4. Once released, subsequent acquisition succeeds
      const lock3 = await RedisService.acquireLock(testKey, 10000);
      expect(lock3.success).toBe(true);
    });

    it("sets, gets, and deletes cache values with TTL support", async () => {
      const cacheKey = `cache-test-${Date.now()}`;
      await RedisService.set(cacheKey, "test-data-value", 60);

      const val = await RedisService.get(cacheKey);
      expect(val).toBe("test-data-value");

      await RedisService.del(cacheKey);
      const valAfterDel = await RedisService.get(cacheKey);
      expect(valAfterDel).toBeNull();
    });
  });

  // ----------------- HL7 FHIR R4 Standard Connector Tests -----------------
  describe("FhirConnector (HL7 FHIR R4 Standards)", () => {
    it("converts internal appointment to HL7 FHIR R4 Appointment resource", () => {
      const mockInternalAppt = {
        id: "apt-123",
        status: "CONFIRMED",
        startTime: new Date("2026-09-18T09:30:00Z"),
        endTime: new Date("2026-09-18T10:00:00Z"),
        patientId: "pat-456",
        doctorId: "doc-789",
        hospitalId: "hosp-101",
        doctor: { name: "Dr. Sarah Patel", specialty: { name: "Dermatology" } },
        patient: { name: "Alex Morgan", phone: "+15551234567", email: "alex@example.com" },
        hospital: { name: "City Care General Hospital" },
      };

      const fhirResource = FhirConnector.toFhirAppointment(mockInternalAppt);

      expect(fhirResource.resourceType).toBe("Appointment");
      expect(fhirResource.id).toBe("apt-123");
      expect(fhirResource.status).toBe("booked");
      expect(fhirResource.start).toBe("2026-09-18T09:30:00.000Z");
      expect(fhirResource.participant.length).toBe(3);

      const patientParticipant = fhirResource.participant.find((p: any) =>
        p.actor.reference.includes("Patient")
      );
      expect(patientParticipant).toBeDefined();
      expect(patientParticipant.actor.display).toBe("Alex Morgan");
    });
  });

  // ----------------- Notification Service Tests -----------------
  describe("NotificationService (SMS & Email Dispatch)", () => {
    it("dispatches SMS notification with database audit persistence", async () => {
      const result = await NotificationService.sendSms({
        correlationId: `test-notif-${Date.now()}`,
        recipientType: "PATIENT",
        recipientPhone: "+15551234567",
        subject: "Unit Test Notification",
        message: "Your appointment is confirmed for Friday at 9:30 AM.",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });
  });
});
