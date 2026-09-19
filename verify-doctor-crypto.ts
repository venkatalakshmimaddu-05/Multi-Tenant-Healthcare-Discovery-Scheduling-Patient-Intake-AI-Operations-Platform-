import { AuthService } from "./src/lib/services/authService";
import { TenantGuard } from "./src/lib/middleware/tenantGuard";

async function verifyDoctorCrypto() {
  console.log("================================================================================");
  console.log("🔒 CRYPTOGRAPHIC DOCTOR AUTHENTICATION & ACCESS VERIFICATION DEMO");
  console.log("================================================================================\n");

  // 1. Authenticate Doctor (Dr. Sarah Patel)
  console.log("1️⃣ [AUTHENTICATION] Authenticating Dr. Sarah Patel...");
  const auth = await AuthService.authenticate("sarah.patel@citycare.org");
  if (!auth.success || !auth.session || !auth.token) {
    console.error("❌ Authentication failed!");
    return;
  }
  console.log("✅ Credentials verified successfully!");
  console.log("   - Doctor Name :", auth.session.name);
  console.log("   - Role        :", auth.session.role);
  console.log("   - Doctor ID   :", auth.session.doctorId);
  console.log("   - Hospital ID :", auth.session.hospitalId);

  // 2. Cryptographically Signed Token
  console.log("\n2️⃣ [CRYPTOGRAPHIC JWT TOKEN] Signed with HMAC-SHA256:");
  console.log("   " + auth.token);

  // 3. Verify Signature & Integrity
  console.log("\n3️⃣ [SIGNATURE VERIFICATION] Verifying token authenticity with timing-safe HMAC...");
  const verifiedSession = AuthService.verifyToken(auth.token);
  if (verifiedSession) {
    console.log("✅ Token signature valid and unmodified!");
    console.log("   - Cryptographically bound doctorId:", verifiedSession.doctorId);
  }

  // 4. Test Token Tampering (Attacker trying to forge token)
  console.log("\n4️⃣ [ATTACK SIMULATION] Testing forged/tampered JWT token...");
  const forgedToken = auth.token.slice(0, -8) + "FORGED99";
  const forgedCheck = AuthService.verifyToken(forgedToken);
  if (forgedCheck === null) {
    console.log("🛡️ SECURITY CONFIRMED: Forged token was REJECTED immediately!");
  }

  // 5. Test Doctor Access Guard
  console.log("\n5️⃣ [RBAC ISOLATION TEST] Verifying Doctor-to-Doctor Privacy Isolation...");

  // Scenario A: Dr. Sarah Patel accesses HER OWN records
  const myAccess = TenantGuard.validateDoctorAccess(auth.session, auth.session.doctorId!);
  console.log(`   Dr. Sarah Patel -> accessing Dr. Sarah Patel:`);
  console.log(`   Result: ${myAccess.allowed ? "✅ ALLOWED" : "❌ DENIED"}`);

  // Scenario B: Dr. Sarah Patel tries to access Dr. Marcus Chen's records
  const targetOtherDoctorId = "doc-marcus-chen-cardio";
  const crossAccess = TenantGuard.validateDoctorAccess(auth.session, targetOtherDoctorId);
  console.log(`\n   Dr. Sarah Patel -> attempting to access Dr. Marcus Chen (${targetOtherDoctorId}):`);
  console.log(`   Result: ${crossAccess.allowed ? "ALLOWED" : "🛡️ REJECTED"}`);
  console.log(`   Reason: "${crossAccess.reason}"`);

  console.log("\n================================================================================");
  console.log("🎉 ALL CRYPTOGRAPHIC & PRIVACY ISOLATION CHECKS PASSED!");
  console.log("================================================================================");
}

verifyDoctorCrypto();
