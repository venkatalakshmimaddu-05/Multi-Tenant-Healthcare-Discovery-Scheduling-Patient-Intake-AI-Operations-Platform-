import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { SchedulingService } from "../../src/lib/services/schedulingService";
import { AiAgentEngine } from "../../src/lib/services/aiAgentEngine";

describe("Scheduling & Concurrency Unit Tests", () => {
  let doctorId: string;
  let patientId: string;

  beforeAll(async () => {
    const doc = await prisma.doctor.findFirst({
      where: { name: { contains: "Rao" } },
    });
    doctorId = doc!.id;

    const pat = await prisma.patient.findFirst();
    patientId = pat!.id;

    await prisma.appointment.deleteMany({
      where: {
        OR: [
          { correlationId: { startsWith: "test-" } },
          { correlationId: { startsWith: "ai-conv" } },
        ],
      },
    });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({
      where: {
        OR: [
          { correlationId: { startsWith: "test-" } },
          { correlationId: { startsWith: "ai-conv" } },
        ],
      },
    });
  });

  it("calculates real availability within doctor working hours", async () => {
    // Upcoming Friday
    const targetDate = new Date();
    const day = targetDate.getDay();
    const diff = (5 - day + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + diff);

    const slots = await SchedulingService.getAvailableSlots(doctorId, targetDate);
    expect(slots.length).toBeGreaterThan(0);
    // Ensure all slots are within 09:00 - 17:00
    for (const slot of slots) {
      const slotHour = new Date(slot.startTime).getHours();
      expect(slotHour).toBeGreaterThanOrEqual(9);
      expect(slotHour).toBeLessThan(17);
    }
  });

  it("prevents concurrent double-booking using mutex locking", () => {
    const testSlot = new Date().toISOString();
    const lock1 = SchedulingService.acquireLock(doctorId, testSlot);
    expect(lock1).toBe(true);

    // Concurrent request for same slot must be rejected
    const lock2 = SchedulingService.acquireLock(doctorId, testSlot);
    expect(lock2).toBe(false);

    // After release, slot can be locked again
    SchedulingService.releaseLock(doctorId, testSlot);
    const lock3 = SchedulingService.acquireLock(doctorId, testSlot);
    expect(lock3).toBe(true);
    SchedulingService.releaseLock(doctorId, testSlot);
  });

  it("strictly refuses clinical diagnosis queries and enforces administrative boundary (PRD Sec 20)", async () => {
    const convId = `test-safety-${Date.now()}`;
    const result = await AiAgentEngine.processTurn(
      convId,
      "Can you diagnose me? I have severe chest pain, do I have a heart disease?",
      patientId
    );

    expect(result.isClinicalRefusal).toBe(true);
    expect(result.replyText).toContain("I am an administrative scheduling assistant and cannot provide medical diagnoses");
  });

  it("resolves multi-turn context and relative dates ('make that Friday')", async () => {
    const convId = `test-context-${Date.now()}`;

    // Turn 1: Specify specialty/doctor
    await AiAgentEngine.processTurn(
      convId,
      "I need to see Dr. Rao for my shoulder pain",
      patientId
    );

    // Turn 2: Contextual update ("Actually, make that Friday")
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "Actually, make that Friday",
      patientId
    );

    expect(turn2.replyText).toContain("Dr. Ananya Rao");
    expect(turn2.replyText.toLowerCase()).toContain("friday");
  });

  it("asks for clarification over guessing when user input is incomplete (PRD Principle 2)", async () => {
    const convId = `test-clarify-${Date.now()}`;
    const result = await AiAgentEngine.processTurn(
      convId,
      "I have",
      patientId
    );

    // Must ask for missing information, NOT guess or pick an arbitrary doctor
    expect(result.replyText).toContain("Could you please tell me what symptoms or health concerns you are experiencing");
    expect(result.replyText).not.toContain("I found openings with Dr.");
  });

  it("does not trigger Dermatology on conversational phrases like 'can I book a spot' or 'last slot'", async () => {
    const convId = `test-no-false-pos-${Date.now()}`;
    const result = await AiAgentEngine.processTurn(
      convId,
      "Can I book an appointment please?",
      patientId
    );

    // Must clarify instead of jumping to Dermatology or another specialty
    expect(result.replyText).toContain("Could you please tell me what symptoms or health concerns you are experiencing");
    expect(result.replyText).not.toContain("Dr. Sarah Patel");
  });

  it("correctly routes skin rashes to Dr. Sarah Patel in Dermatology at City Care Hospital", async () => {
    const convId = `test-derma-${Date.now()}`;
    const result = await AiAgentEngine.processTurn(
      convId,
      "I have skin rashes and need to see a dermatologist",
      patientId
    );

    expect(result.replyText).toContain("Dr. Sarah Patel");
    expect(result.replyText).toContain("Dermatology");
    expect(result.replyText).toContain("City Care General Hospital");
    expect(result.capabilityCalled).toBe("check_availability");
  });

  it("dynamically resets doctor context when switching symptoms from Orthopedics to Dermatology", async () => {
    const convId = `test-switch-${Date.now()}`;

    // Turn 1: Patient starts with shoulder pain (Orthopedics / Dr. Rao)
    const turn1 = await AiAgentEngine.processTurn(
      convId,
      "I have shoulder pain",
      patientId
    );
    expect(turn1.replyText).toContain("Dr. Ananya Rao");
    expect(turn1.replyText).toContain("Orthopedics");

    // Turn 2: Patient switches symptoms to skin rashes (Dermatology / Dr. Patel)
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "Actually I also have skin rashes, can I see a skin doctor?",
      patientId
    );
    expect(turn2.replyText).toContain("Dr. Sarah Patel");
    expect(turn2.replyText).toContain("Dermatology");
    expect(turn2.replyText).not.toContain("Dr. Ananya Rao");
  });

  it("handles speech recognition phonetic artifacts like 'Skinny lashes' to Dermatology", async () => {
    const convId = `test-phonetic-${Date.now()}`;

    // Browser speech recognition often transcribes 'skin rashes' as 'Skinny lashes'
    const result = await AiAgentEngine.processTurn(
      convId,
      "Skinny lashes",
      patientId
    );

    expect(result.replyText).toContain("Dr. Sarah Patel");
    expect(result.replyText).toContain("Dermatology");
  });

  it("correctly routes cardiology symptoms to Dr. Marcus Chen", async () => {
    const convId = `test-cardio-${Date.now()}`;
    const result = await AiAgentEngine.processTurn(
      convId,
      "I have chest pain and heart palpitations",
      patientId
    );

    expect(result.replyText).toContain("Dr. Marcus Chen");
    expect(result.replyText).toContain("Cardiology");
    expect(result.replyText).toContain("Metro Health Medical Center");
  });

  it("confirms booking when patient selects slot with 'At 9 30' or 'Mind that'", async () => {
    const convId = `test-book-slot-${Date.now()}`;

    // Turn 1: Patient asks for skin rashes
    const turn1 = await AiAgentEngine.processTurn(
      convId,
      "I have a skin rash and need a doctor",
      patientId
    );
    expect(turn1.replyText).toContain("Dr. Sarah Patel");
    expect(turn1.capabilityCalled).toBe("check_availability");

    // Turn 2: Patient says "At 9 30"
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "At 9 30",
      patientId
    );

    expect(turn2.capabilityCalled).toBe("create_appointment");
    expect(turn2.actionTaken).toBe("APPOINTMENT_CONFIRMED");
    expect(turn2.replyText).toContain("confirmed");
    expect(turn2.replyText).toContain("Dr. Sarah Patel");
  });

  it("guides patient to questionnaire panel when asking 'Where should I complete the three visiting question Three' after booking", async () => {
    const convId = `test-post-booking-questionnaire-${Date.now()}`;

    // Turn 1: Patient asks for skin rashes
    await AiAgentEngine.processTurn(
      convId,
      "I have a skin rash and need to see a dermatologist",
      patientId
    );

    // Turn 2: Patient books a slot
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "The first one please",
      patientId
    );
    expect(turn2.actionTaken).toBe("APPOINTMENT_CONFIRMED");

    // Turn 3: Patient asks where to complete the questionnaire (using speech recognition transcription artifact)
    const turn3 = await AiAgentEngine.processTurn(
      convId,
      "Where should I complete the three visiting question Three",
      patientId
    );

    // Must NOT repeat doctor availability or recommend another slot!
    expect(turn3.replyText).not.toContain("I found openings with Dr.");
    expect(turn3.replyText).toContain("Pre-Visit Intake Questionnaire");
    expect(turn3.replyText).toContain("right-hand panel");
    expect(turn3.capabilityCalled).toBe("get_questionnaire");
    expect(turn3.capabilityResult).toBeDefined();
    expect(turn3.capabilityResult.title).toContain("Dermatology");
  });

  it("answers appointment status questions without re-initiating booking", async () => {
    const convId = `test-appt-status-${Date.now()}`;

    // Turn 1: Patient asks what time their appointment is
    const result = await AiAgentEngine.processTurn(
      convId,
      "When is my appointment?",
      patientId
    );

    expect(result.replyText).not.toContain("I found openings with Dr.");
    expect(result.replyText.toLowerCase()).toContain("appointment");
  });

  it("provides clear platform and portal navigation instructions", async () => {
    const convId = `test-navigation-${Date.now()}`;

    const result = await AiAgentEngine.processTurn(
      convId,
      "How do I use this website and where is the patient portal?",
      patientId
    );

    expect(result.replyText).toContain("Patient Portal");
    expect(result.replyText).toContain("AuraCare");
    expect(result.replyText).not.toContain("I found openings with Dr.");
  });

  it("handles gratitude warmly without prompting to book doctors again", async () => {
    const convId = `test-gratitude-${Date.now()}`;

    const result = await AiAgentEngine.processTurn(
      convId,
      "Thank you so much, that's all!",
      patientId
    );

    expect(result.replyText).toContain("welcome");
    expect(result.replyText).not.toContain("I found openings with Dr.");
  });

  it("does not book Friday when patient says 'I cannot I cannot I do not have a time on Friday on September' and offers alternative day", async () => {
    const convId = `test-reject-friday-${Date.now()}`;

    // Turn 1: Patient asks to see Dr. Kim for Friday
    const turn1 = await AiAgentEngine.processTurn(
      convId,
      "I need to see Dr. Kim this Friday",
      patientId
    );
    expect(turn1.replyText).toContain("Dr. David Kim");
    expect(turn1.replyText.toLowerCase()).toContain("friday");

    // Turn 2: Patient rejects Friday with repetition / negation
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "I cannot I cannot I do not have a time on Friday on September",
      patientId
    );

    // Must NOT confirm appointment or book Friday!
    expect(turn2.actionTaken).not.toBe("APPOINTMENT_CONFIRMED");
    expect(turn2.replyText).not.toContain("is confirmed for");
    // Must offer another day instead of Friday
    expect(turn2.replyText.toLowerCase()).toContain("another day");
    expect(turn2.replyText.toLowerCase()).toContain("monday");
  });

  it("handles patient having plans on Friday and wanting another day without falsely confirming", async () => {
    const convId = `test-plans-friday-${Date.now()}`;

    // Turn 1: Patient asks for skin doctor on Friday
    const turn1 = await AiAgentEngine.processTurn(
      convId,
      "I have skin rashes and want to see a doctor this Friday",
      patientId
    );
    expect(turn1.replyText).toContain("Dr. Sarah Patel");
    expect(turn1.replyText.toLowerCase()).toContain("friday");

    // Turn 2: Patient states plans on Friday and requests another day
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "I have plans on Friday and I want another day for the appointment",
      patientId
    );

    // Must NOT book Friday!
    expect(turn2.actionTaken).not.toBe("APPOINTMENT_CONFIRMED");
    expect(turn2.replyText).not.toContain("is confirmed for");
    expect(turn2.replyText.toLowerCase()).toContain("another day");
    expect(turn2.replyText.toLowerCase()).toContain("monday");

    // Turn 3: Patient picks a slot on the new day ("At 11 am")
    const turn3 = await AiAgentEngine.processTurn(
      convId,
      "At 11 am",
      patientId
    );

    expect(turn3.actionTaken).toBe("APPOINTMENT_CONFIRMED");
    expect(turn3.replyText).toContain("confirmed");
    expect(turn3.replyText.toLowerCase()).toContain("mon");
    expect(turn3.replyText).toContain("11:00 AM");
  });

  it("handles patient rejecting Friday and requesting Monday directly", async () => {
    const convId = `test-direct-reschedule-${Date.now()}`;

    // Turn 1: Patient asks for doctor
    await AiAgentEngine.processTurn(
      convId,
      "I need a doctor for my chest pain this Friday",
      patientId
    );

    // Turn 2: Patient rejects Friday and asks for Monday
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "I can't do Friday, can we do Monday?",
      patientId
    );

    expect(turn2.actionTaken).not.toBe("APPOINTMENT_CONFIRMED");
    expect(turn2.replyText).not.toContain("is confirmed for");
    expect(turn2.replyText.toLowerCase()).toContain("monday");
  });

  it("reschedules confirmed appointment when patient changes timing ('I want appointment on Friday Friday 10 o'clock') without asking for symptoms", async () => {
    const convId = `test-reschedule-timing-${Date.now()}`;

    // Turn 1: Patient asks to see Dr. David Kim for Thursday
    const turn1 = await AiAgentEngine.processTurn(
      convId,
      "I want to see Dr. David Kim this Thursday",
      patientId
    );
    expect(turn1.replyText).toContain("Dr. David Kim");
    expect(turn1.replyText.toLowerCase()).toContain("thursday");

    // Turn 2: Patient confirms Thursday slot
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "The first one please",
      patientId
    );
    expect(turn2.actionTaken).toBe("APPOINTMENT_CONFIRMED");
    expect(turn2.replyText).toContain("confirmed");
    expect(turn2.replyText.toLowerCase()).toContain("thu");

    // Verify initial appointment exists in database
    const initialAppts = await prisma.appointment.findMany({
      where: { patientId, status: "CONFIRMED" },
    });
    expect(initialAppts.length).toBeGreaterThan(0);
    const initialApptId = initialAppts[initialAppts.length - 1].id;

    // Turn 3: Patient asks to change timings / reschedule: "I want appointment on Friday Friday 10 o'clock"
    const turn3 = await AiAgentEngine.processTurn(
      convId,
      "I want appointment on Friday Friday 10 o'clock",
      patientId
    );

    // Must NOT ask for symptoms or health concerns!
    expect(turn3.replyText).not.toContain("symptoms or health concerns");
    expect(turn3.replyText).not.toContain("specific doctor in mind");

    // Must reschedule appointment to Friday at 10:00 AM
    expect(turn3.actionTaken).toBe("APPOINTMENT_RESCHEDULED");
    expect(turn3.replyText).toContain("rescheduled");
    expect(turn3.replyText).toContain("Dr. David Kim");
    expect(turn3.replyText.toLowerCase()).toContain("fri");
    expect(turn3.replyText).toContain("10:00 AM");

    // Verify old appointment was cancelled and slot released
    const oldAppt = await prisma.appointment.findUnique({
      where: { id: initialApptId },
    });
    expect(oldAppt?.status).toBe("CANCELLED");
  });

  it("allows rescheduling by day first, presenting options, and then choosing slot", async () => {
    const convId = `test-reschedule-two-step-${Date.now()}`;

    // Turn 1: Patient books Dr. David Kim
    await AiAgentEngine.processTurn(
      convId,
      "I want to see Dr. David Kim this Thursday",
      patientId
    );
    await AiAgentEngine.processTurn(
      convId,
      "9 am",
      patientId
    );

    // Turn 2: Patient asks to reschedule to Friday without specifying time
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "Can I reschedule to Friday?",
      patientId
    );

    expect(turn2.replyText).not.toContain("symptoms");
    expect(turn2.replyText).toContain("Dr. David Kim");
    expect(turn2.replyText.toLowerCase()).toContain("fri");

    // Turn 3: Patient selects "At 9 30"
    const turn3 = await AiAgentEngine.processTurn(
      convId,
      "At 9 30",
      patientId
    );

    expect(turn3.actionTaken).toBe("APPOINTMENT_RESCHEDULED");
    expect(turn3.replyText).toContain("rescheduled");
    expect(turn3.replyText).toContain("9:30 AM");
  });

  it("routes new symptoms ('I feel nauseous and No long things are happening') to General Medicine and clears previous orthopedic doctor", async () => {
    const convId = `test-symptom-switch-${Date.now()}`;

    // Turn 1: Patient books Dr. Ananya Rao for shoulder pain
    await AiAgentEngine.processTurn(
      convId,
      "I need to see Dr. Ananya Rao for severe shoulder pain",
      patientId
    );
    const turn1Confirm = await AiAgentEngine.processTurn(
      convId,
      "The first one please",
      patientId
    );
    expect(turn1Confirm.actionTaken).toBe("APPOINTMENT_CONFIRMED");

    // Turn 2: Patient discusses new symptoms: nausea
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "I feel nauseous and No long things are happening",
      patientId
    );

    // Must route to General Medicine (e.g. Dr. David Kim), NOT Dr. Ananya Rao (Orthopedics)
    expect(turn2.replyText).not.toContain("Dr. Ananya Rao");
    expect(turn2.replyText).toContain("Dr. David Kim");
    expect(turn2.replyText).toContain("General Medicine");
  });

  it("routes 'I have a ear problem Water went into here' to ENT (Dr. Robert Sterling) instead of Dermatology even after discussing Dr. Sarah Patel", async () => {
    const convId = `test-ear-problem-${Date.now()}`;

    // Turn 1: Patient originally asked for Dr. Sarah Patel (Dermatology)
    const turn1 = await AiAgentEngine.processTurn(
      convId,
      "I need to see Dr. Sarah Patel for a skin rash",
      patientId
    );
    expect(turn1.replyText).toContain("Dr. Sarah Patel");
    expect(turn1.replyText).toContain("Dermatology");

    // Turn 2: Patient switches to: "I have a ear problem Water went into here"
    const turn2 = await AiAgentEngine.processTurn(
      convId,
      "I have a ear problem Water went into here",
      patientId
    );

    // Must NOT recommend Dr. Sarah Patel (Dermatology) for an ear problem!
    expect(turn2.replyText).not.toContain("Dr. Sarah Patel");
    expect(turn2.replyText).not.toContain("Dermatology");

    // Must recommend ENT (Otolaryngology) specialist Dr. Robert Sterling!
    expect(turn2.replyText).toContain("Dr. Robert Sterling");
    expect(turn2.replyText).toContain("ENT (Otolaryngology)");
    expect(turn2.capabilityCalled).toBe("check_availability");
  });

  it("accurately routes eye problems to Ophthalmology and brain/nerve symptoms to Neurology", async () => {
    const convEye = `test-eye-${Date.now()}`;
    const resultEye = await AiAgentEngine.processTurn(
      convEye,
      "My vision is blurry and I have eye pain",
      patientId
    );
    expect(resultEye.replyText).toContain("Dr. Elena Rostova");
    expect(resultEye.replyText).toContain("Ophthalmology");

    const convNeuro = `test-neuro-${Date.now()}`;
    const resultNeuro = await AiAgentEngine.processTurn(
      convNeuro,
      "I have severe migraines and numbness in my hands",
      patientId
    );
    expect(resultNeuro.replyText).toContain("Dr. Sanjay Gupta");
    expect(resultNeuro.replyText).toContain("Neurology");
  });
});