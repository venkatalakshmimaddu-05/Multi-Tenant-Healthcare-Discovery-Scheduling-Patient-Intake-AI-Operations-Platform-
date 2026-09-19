import { ClinicalKnowledgeBase } from "./clinicalKnowledgeBase";
import { ClinicalAssessment, StructuredPatientState } from "./types";

/**
 * Deterministic Clinical Safety & Red-Flag Screening Layer
 * 
 * Compliant with PRD Section 20 Clinical Safety Guardrails.
 * Evaluates deterministic emergency criteria prior to routine scheduling.
 * A positive red-flag match halts routine booking and triggers immediate
 * emergency escalation (911 / Emergency Department).
 */
export class RedFlagSafetyLayer {
  /**
   * Evaluates all deterministic red-flag safety rules against structured state and raw text.
   * Returns an array of identified clinical red flags.
   */
  public static evaluate(state: StructuredPatientState, rawText: string): string[] {
    const text = rawText.toLowerCase();
    const flags: string[] = [];

    for (const rule of ClinicalKnowledgeBase.RED_FLAG_RULES) {
      if (rule.evaluate(state, rawText)) {
        if (!flags.includes(rule.name)) {
          flags.push(rule.name);
        }
      }
    }

    // Additional deterministic cross-checks
    // 1. ACS: Crushing chest pain or radiation to jaw/left arm or severe chest pain + dyspnea
    if (
      (text.includes("chest") &&
        (text.includes("crushing") ||
          text.includes("pressure") ||
          text.includes("radiat") ||
          text.includes("jaw") ||
          text.includes("left arm"))) ||
      (state.symptoms.includes("chest pain") &&
        state.symptoms.includes("shortness of breath") &&
        state.severity === "severe")
    ) {
      const acsFlag = "Suspicion of Acute Coronary Syndrome (crushing chest pain / radiation / severe dyspnea)";
      if (!flags.some((f) => f.includes("Acute Coronary Syndrome"))) {
        flags.push(acsFlag);
      }
    }

    // 2. Stroke / Neuro Emergency
    if (
      text.includes("thunderclap") ||
      text.includes("worst headache of my life") ||
      text.includes("worst headache ever") ||
      (state.symptoms.includes("headache") && state.onset === "sudden" && state.severity === "severe") ||
      text.includes("facial droop") ||
      text.includes("slurred speech") ||
      text.includes("cannot move arm") ||
      text.includes("one side of my body")
    ) {
      const neuroFlag = "Potential Neurological Emergency / Cerebrovascular Event (sudden severe headache or focal deficit)";
      if (!flags.some((f) => f.includes("Neurological Emergency"))) {
        flags.push(neuroFlag);
      }
    }

    // 3. Acute GI bleed / acute abdomen
    if (
      text.includes("vomiting blood") ||
      text.includes("throwing up blood") ||
      text.includes("black tarry stool") ||
      text.includes("blood in vomit") ||
      (state.symptoms.includes("stomach pain") &&
        state.severity === "severe" &&
        (text.includes("rigid") || text.includes("cannot touch") || text.includes("passed out") || text.includes("fainted")))
    ) {
      const giFlag = "Signs of Acute Gastrointestinal Hemorrhage or Peritoneal Emergency";
      if (!flags.some((f) => f.includes("Gastrointestinal Hemorrhage"))) {
        flags.push(giFlag);
      }
    }

    // 4. Anaphylaxis / Airway
    if (
      text.includes("throat closing") ||
      text.includes("lips swelling") ||
      text.includes("tongue swelling") ||
      text.includes("cannot swallow saliva")
    ) {
      const airwayFlag = "Signs of Impending Airway Compromise or Anaphylaxis";
      if (!flags.some((f) => f.includes("Airway Compromise"))) {
        flags.push(airwayFlag);
      }
    }

    state.red_flags = flags;
    return flags;
  }

  /**
   * Constructs the emergency clinical assessment that strictly refuses
   * routine appointment booking and guides the user to immediate emergency care.
   */
  public static buildEmergencyAssessment(
    state: StructuredPatientState,
    redFlags: string[]
  ): ClinicalAssessment {
    const primaryWarning = redFlags[0] || "Potential acute medical emergency";

    const guidance =
      redFlags.some((f) => f.includes("Anaphylaxis"))
        ? "Call 911 immediately. If you have an epinephrine auto-injector, use it now."
        : `Your symptoms include urgent warning signs (${primaryWarning}). Please call 911 or go to the nearest emergency room immediately. I cannot safely schedule a routine clinic visit for this emergency.`;

    return {
      understood_symptoms: state.symptoms,
      important_missing_information: [],
      red_flags: redFlags,
      possible_causes: [
        "Potential acute life-threatening medical condition requiring emergency department evaluation",
      ],
      urgency: "EMERGENCY_911",
      recommended_specialty: "Emergency Medicine",
      recommended_next_step: "Call 911 or proceed immediately to the nearest emergency room.",
      reasoning_basis: redFlags.join("; "),
      voice_reply: guidance,
      isEmergency: true,
      needsFollowUp: false,
    };
  }
}
