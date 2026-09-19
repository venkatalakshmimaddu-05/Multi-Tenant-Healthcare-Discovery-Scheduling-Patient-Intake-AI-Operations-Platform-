import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { ClinicalTriageEngine } from "../../src/lib/services/clinicalTriageEngine";
import { AiAgentEngine } from "../../src/lib/services/aiAgentEngine";

describe("Medical Symptom Assessment & Clinical Triage Reasoning Engine", () => {
  let patientId: string;

  beforeAll(async () => {
    const pat = await prisma.patient.findFirst();
    patientId = pat ? pat.id : "test-pat-triage";

    // Clean up any test conversations
    await prisma.aiContext.deleteMany({
      where: {
        extractedEntities: { contains: "test-triage" },
      },
    });
  });

  afterAll(async () => {
    await prisma.aiContext.deleteMany({
      where: {
        extractedEntities: { contains: "test-triage" },
      },
    });
  });

  describe("Clinical Entity Extraction & Structured Patient State", () => {
    it("extracts multi-symptom inventory, severity, and detects missing information", () => {
      // INPUT: User prompt reported in bug report
      const input = "i have severe stomach pain and fell nausease and a little headache so what should ido for thse syptomes";

      const state = ClinicalTriageEngine.extractAndAccumulate(input);

      // EXPECTED EXTRACTION
      expect(state.symptoms).toContain("stomach pain");
      expect(state.symptoms).toContain("nausea");
      expect(state.symptoms).toContain("headache");
      expect(state.severity).toBe("severe");
      expect(state.duration).toBeNull();

      // EXPECTED MISSING INFORMATION
      const missing = ClinicalTriageEngine.detectMissingInformation(state);
      expect(missing.some((m) => m.includes("duration"))).toBe(true);
      expect(missing.some((m) => m.includes("fever"))).toBe(true);

      // RED-FLAG CHECK: No red flags for uncomplicated acute symptoms
      const redFlags = ClinicalTriageEngine.evaluateRedFlags(state, input);
      expect(redFlags).toHaveLength(0);

      // EXPECTED ASSESSMENT & FOLLOW-UP
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, redFlags);
      expect(assessment.needsFollowUp).toBe(true);
      expect(assessment.recommended_specialty).toBe("Gastroenterology");
      expect(assessment.possible_causes).toEqual(
        expect.arrayContaining([
          expect.stringContaining("gastroenteritis"),
          expect.stringContaining("Foodborne"),
        ])
      );
      // Voice response should ask ONE focused follow-up question
      expect(assessment.voice_reply).toContain("how long have you had these symptoms, and do you also have a fever?");
    });

    it("handles negation of symptoms accurately without false positives", () => {
      const input = "I have had stomach cramps for 2 days, but no fever and no vomiting";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);

      expect(state.symptoms).toContain("stomach pain");
      expect(state.symptoms).not.toContain("fever / chills");
      expect(state.symptoms).not.toContain("vomiting");
      expect(state.denied_symptoms).toContain("fever");
      expect(state.denied_symptoms).toContain("vomiting");
      expect(state.duration).toBe("for 2 days");

      // Since duration and fever are both known, missing info should not demand fever or duration
      const missing = ClinicalTriageEngine.detectMissingInformation(state);
      expect(missing.some((m) => m.includes("duration"))).toBe(false);
      expect(missing.some((m) => m.includes("fever"))).toBe(false);
    });
  });

  describe("Deterministic Red-Flag & Emergency Urgency Screening", () => {
    it("escalates crushing chest pain radiating to left arm to EMERGENCY_911", () => {
      const input = "I am having severe crushing chest pain radiating down my left arm with shortness of breath";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const redFlags = ClinicalTriageEngine.evaluateRedFlags(state, input);

      expect(redFlags.length).toBeGreaterThan(0);
      expect(redFlags[0]).toContain("Acute Coronary Syndrome");

      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, redFlags);
      expect(assessment.isEmergency).toBe(true);
      expect(assessment.urgency).toBe("EMERGENCY_911");
      expect(assessment.recommended_specialty).toBe("Emergency Medicine");
      expect(assessment.voice_reply).toContain("call 911");
      expect(assessment.voice_reply).toContain("cannot safely schedule a routine clinic visit");
    });

    it("escalates sudden thunderclap headache to EMERGENCY_911", () => {
      const input = "I have a sudden thunderclap worst headache of my life";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const redFlags = ClinicalTriageEngine.evaluateRedFlags(state, input);

      expect(redFlags.length).toBeGreaterThan(0);
      expect(redFlags[0]).toContain("Neurological Emergency");

      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, redFlags);
      expect(assessment.isEmergency).toBe(true);
      expect(assessment.urgency).toBe("EMERGENCY_911");
      expect(assessment.voice_reply).toContain("911");
    });
  });

  describe("Organ System Routing Accuracy & Anti-Hallucination", () => {
    it("routes ear symptoms strictly to Otolaryngology (ENT) and NOT Dermatology", () => {
      const input = "water went into my ear while swimming and now my ear is aching and muffled";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const redFlags = ClinicalTriageEngine.evaluateRedFlags(state, input);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, redFlags);

      expect(assessment.recommended_specialty).toBe("ENT (Otolaryngology)");
      expect(assessment.recommended_specialty).not.toBe("Dermatology");
      expect(assessment.recommended_specialty).not.toBe("Gastroenterology");
    });

    it("routes eye pain and blurry vision to Ophthalmology", () => {
      const input = "My eye is very red, watery, and I have blurry vision";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, []);

      expect(assessment.recommended_specialty).toBe("Ophthalmology");
      expect(assessment.possible_causes.some((c) => c.includes("conjunctivitis") || c.includes("Corneal"))).toBe(true);
    });

    it("routes severe stomach pain to Gastroenterology and NEVER to Otolaryngology (ENT)", () => {
      const input = "severe stomach pain and nausea for 3 days";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, []);

      expect(assessment.recommended_specialty).toBe("Gastroenterology");
      expect(assessment.recommended_specialty).not.toBe("ENT (Otolaryngology)");
      expect(assessment.reasoning_basis).toContain("Otolaryngology (ENT) is clinically unrelated to abdominal complaints");
    });
  });

  describe("End-to-End Multi-Turn Voice Dialogue Flow via AiAgentEngine", () => {
    it("handles the user's stomach complaint across turns: asks follow-up, then books Gastroenterologist, NEVER ENT", async () => {
      const corrId = `test-triage-${Date.now()}`;

      // TURN 1: User presents the exact complaint from the problem statement
      const turn1 = await AiAgentEngine.processDialogueTurn(
        patientId,
        "i have severe stomach pain and fell nausease and a little headache so what should ido for thse syptomes",
        corrId
      );

      // Verify Turn 1 asks the single conversational follow-up question
      expect(turn1.replyText).toContain("how long have you had these symptoms, and do you also have a fever?");
      // Must NOT prematurely book or recommend Dr. Robert Sterling (ENT)
      expect(turn1.replyText).not.toContain("Sterling");
      expect(turn1.replyText).not.toContain("Otolaryngology");

      // TURN 2: Patient answers the follow-up question
      const turn2 = await AiAgentEngine.processDialogueTurn(
        patientId,
        "I have had these symptoms since yesterday and no fever, can I see a doctor?",
        corrId
      );

      // Verify Turn 2:
      // 1. Recommends Gastroenterology
      // 2. Recommends Gastroenterologist (Dr. Lisa Wang or Dr. Sanjay Gupta)
      // 3. Articulates the clinical differential rationale
      // 4. Offers real availability slots
      // 5. Does NOT recommend Dr. Robert Sterling (ENT)
      expect(turn2.replyText).toContain("Gastroenterology");
      expect(turn2.replyText).toMatch(/Dr\.\s+(?:Lisa Wang|Sanjay Gupta)/);
      expect(turn2.replyText).toContain("Which time works best for you?");
      expect(turn2.replyText).not.toContain("Robert Sterling");
      expect(turn2.replyText).not.toContain("Otolaryngology");
    });

    it("rejects emergency symptoms immediately and refuses routine clinic booking", async () => {
      const corrId = `test-triage-emerg-${Date.now()}`;

      const turn = await AiAgentEngine.processDialogueTurn(
        patientId,
        "I have crushing chest pain radiating to my left jaw and I can barely breathe, please book me a slot",
        corrId
      );

      expect(turn.isClinicalRefusal).toBe(true);
      expect(turn.replyText).toContain("911");
      expect(turn.replyText).toContain("emergency room");
      expect(turn.replyText).not.toContain("Which time works best for you?");
    });
  });

  describe("Extended Clinical Assertion, Uncertainty & Colloquial Phrasing", () => {
    it("differentiates PRESENT, NEGATED, and UNCERTAIN symptom statuses in structured state", () => {
      const input = "I have a sharp cough and maybe a fever, but definitely no chest pain and no shortness of breath";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);

      // Present
      expect(state.symptoms).toContain("cough");
      expect(state.symptomProfiles["cough"]?.status).toBe("PRESENT");

      // Uncertain
      expect(state.uncertain_symptoms).toContain("fever / chills");
      expect(state.symptomProfiles["fever"]?.status).toBe("UNCERTAIN");
      expect(state.symptoms).not.toContain("fever / chills");

      // Negated
      expect(state.denied_symptoms).toContain("chest pain");
      expect(state.denied_symptoms).toContain("shortness of breath");
      expect(state.symptoms).not.toContain("chest pain");
      expect(state.symptoms).not.toContain("shortness of breath");
      expect(state.symptomProfiles["chest_pain_discomfort"]?.status).toBe("NEGATED");
      expect(state.symptomProfiles["dyspnea"]?.status).toBe("NEGATED");
    });

    it("accurately parses colloquial expressions without falling back to keyword heuristics", () => {
      // 1. "belly in knots" -> stomach pain
      const s1 = ClinicalTriageEngine.extractAndAccumulate("my belly in knots since this morning");
      expect(s1.symptoms).toContain("stomach pain");
      expect(s1.duration).toBe("since this morning");

      // 2. "pins and needles" -> numbness / tingling
      const s2 = ClinicalTriageEngine.extractAndAccumulate("I have severe pins and needles in my right hand");
      expect(s2.symptoms).toContain("numbness / tingling");
      expect(s2.severity).toBe("severe");

      // 3. "room is spinning" -> dizziness / vertigo
      const s3 = ClinicalTriageEngine.extractAndAccumulate("the room is spinning and I feel unsteady on feet");
      expect(s3.symptoms).toContain("dizziness / vertigo");
    });
  });

  describe("Comprehensive Deterministic Emergency Rule Coverage", () => {
    it("flags acute stroke / FAST criteria as EMERGENCY_911", () => {
      const input = "My grandmother suddenly has facial droop and slurred speech and cannot move arm";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const redFlags = ClinicalTriageEngine.evaluateRedFlags(state, input);

      expect(redFlags.length).toBeGreaterThan(0);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, redFlags);
      expect(assessment.isEmergency).toBe(true);
      expect(assessment.urgency).toBe("EMERGENCY_911");
      expect(assessment.voice_reply).toContain("911");
    });

    it("flags acute gastrointestinal hemorrhage (vomiting blood) as EMERGENCY_911", () => {
      const input = "I am throwing up blood and have terrible stomach cramps";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const redFlags = ClinicalTriageEngine.evaluateRedFlags(state, input);

      expect(redFlags.length).toBeGreaterThan(0);
      expect(redFlags.some((f) => f.includes("Gastrointestinal Hemorrhage"))).toBe(true);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, redFlags);
      expect(assessment.isEmergency).toBe(true);
      expect(assessment.urgency).toBe("EMERGENCY_911");
    });

    it("flags impending airway compromise / anaphylaxis as EMERGENCY_911", () => {
      const input = "My throat closing up, lips swelling after eating shellfish";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const redFlags = ClinicalTriageEngine.evaluateRedFlags(state, input);

      expect(redFlags.length).toBeGreaterThan(0);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, redFlags);
      expect(assessment.isEmergency).toBe(true);
      expect(assessment.urgency).toBe("EMERGENCY_911");
      expect(assessment.voice_reply).toContain("epinephrine");
    });
  });

  describe("Cross-Specialty Safety & Anti-Hallucination Matrix", () => {
    it("routes cutaneous rashes strictly to Dermatology and not to General Surgery or ENT", () => {
      const input = "I have an itchy red rash with small blisters on my arm";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, []);

      expect(assessment.recommended_specialty).toBe("Dermatology");
      expect(assessment.recommended_specialty).not.toBe("ENT (Otolaryngology)");
      expect(assessment.recommended_specialty).not.toBe("Gastroenterology");
    });

    it("routes orthopedic joint pain to Orthopedics and not to Cardiology or Dermatology", () => {
      const input = "I twisted my knee playing soccer and now have severe knee pain and swelling";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, []);

      expect(assessment.recommended_specialty).toBe("Orthopedics");
      expect(assessment.possible_causes.some((c) => c.includes("sprain") || c.includes("strain"))).toBe(true);
    });

    it("routes non-emergency chest pain to Cardiology for clearance", () => {
      const input = "mild chest tightness and palpitations when walking up stairs for 2 weeks";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, []);

      expect(assessment.recommended_specialty).toBe("Cardiology");
      expect(assessment.urgency).toBe("SAME_DAY_EVALUATION");
    });

    it("communicates diagnostic uncertainty ethically without asserting definitive diagnosis", () => {
      const input = "I have ear pain and muffled hearing after swimming";
      const state = ClinicalTriageEngine.extractAndAccumulate(input);
      const assessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(state, []);

      // Must frame as possibilities/considerations, never "You have X"
      expect(assessment.voice_reply).toMatch(/several possibilities such as|could be involved|possible considerations/i);
      expect(assessment.voice_reply).not.toMatch(/^You have otitis/i);
      expect(assessment.reasoning_basis).toBeTruthy();
    });
  });
});
