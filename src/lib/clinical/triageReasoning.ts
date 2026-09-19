import { ClinicalKnowledgeBase } from "./clinicalKnowledgeBase";
import { RedFlagSafetyLayer } from "./redFlagSafety";
import {
  ClinicalAssessment,
  DifferentialPossibility,
  StructuredPatientState,
} from "./types";

/**
 * Missing-Information Detection Engine
 * 
 * Prioritizes missing clinical parameters based on clinical risk:
 * 1. Emergency Risk & Red-Flag discrimination (e.g., sudden onset for headache, chest radiation)
 * 2. Differential discrimination (e.g., fever/vomiting for abdominal pain, trauma for joint pain)
 * 3. Care level & functional acuity (e.g., duration of acute symptoms)
 */
export class MissingInformationEngine {
  public static detect(state: StructuredPatientState): string[] {
    const missing: string[] = [];
    const symptoms = state.symptoms;
    const denied = state.denied_symptoms;

    const hasStomach = symptoms.some(
      (s) => s.includes("stomach") || s.includes("abdominal") || s.includes("nausea") || s.includes("cramp")
    );
    const hasHeadache = symptoms.some((s) => s.includes("headache") || s.includes("migraine"));
    const hasJoint = symptoms.some(
      (s) => s.includes("joint") || s.includes("knee") || s.includes("shoulder") || s.includes("back")
    );
    const hasChest = symptoms.some((s) => s.includes("chest"));

    // 1. Duration for acute symptoms
    if (!state.duration && symptoms.length > 0) {
      missing.push("duration (how long symptoms have persisted)");
    }

    // 2. For abdominal/stomach symptoms: fever or vomiting
    if (symptoms.some((s) => s.includes("stomach") || s.includes("abdominal") || s.includes("nausea"))) {
      const feverKnown = symptoms.some((s) => s.includes("fever")) || denied.includes("fever");
      const vomitKnown = symptoms.some((s) => s.includes("vomit")) || denied.includes("vomiting");
      if (!feverKnown && !vomitKnown) {
        missing.push("presence of fever or active vomiting");
      }
    }

    // 3. For headache: sudden onset vs gradual onset
    if (symptoms.some((s) => s.includes("headache") || s.includes("migraine")) && !state.onset) {
      missing.push("onset speed (sudden vs gradual)");
    }

    // 4. For joint pain: trauma or injury history
    if (
      symptoms.some((s) => s.includes("joint") || s.includes("knee") || s.includes("shoulder") || s.includes("back")) &&
      state.recent_events.length === 0
    ) {
      missing.push("history of recent trauma or injury");
    }

    state.missing_information = missing;
    return missing;
  }
}

/**
 * Multi-System Differential & Specialty Reasoning Engine
 * 
 * Formulates differential considerations with clear expression of uncertainty.
 * Recommends appropriate clinical specialty while maintaining strict cross-specialty safety.
 */
export class DifferentialEngine {
  public static formulate(
    state: StructuredPatientState,
    redFlags: string[],
    rawText?: string
  ): ClinicalAssessment {
    // 1. If Red Flags are present, emergency escalation is mandatory
    if (redFlags.length > 0) {
      return RedFlagSafetyLayer.buildEmergencyAssessment(state, redFlags);
    }

    // 2. Evaluate controlled medical knowledge differential
    const differentialResult = ClinicalKnowledgeBase.evaluateDifferential(state);

    const possibleCauses = differentialResult.possibilities.map(
      (p: DifferentialPossibility) => p.conditionName
    );
    const specialty = differentialResult.recommendedSpecialty;
    const urgency = differentialResult.urgency;
    const reasoningBasis = differentialResult.reasoningBasis;

    state.differential_considerations = possibleCauses;
    state.triage_level = urgency;

    // 3. Determine whether a conversational follow-up is needed
    const symptomsSummary = state.symptoms.length > 0 ? state.symptoms.join(", ") : "your symptoms";

    const hasStomach = state.symptoms.some(
      (s) => s.includes("stomach") || s.includes("abdominal") || s.includes("nausea") || s.includes("cramp")
    );
    const hasHeadache = state.symptoms.some((s) => s.includes("headache") || s.includes("migraine"));
    const hasChest = state.symptoms.some((s) => s.includes("chest"));

    const isMultiSystemCluster = (hasStomach && hasHeadache) || (hasChest && hasHeadache);
    const isSeekingAdvice = /\b(?:what\s+should\s+i\s+do|what\s+to\s+do|what\s+do\s+i\s+do|so\s+what\s+should|advice|recommend|recommendation|help\s+me\s+decide|not\s+sure\s+what)\b/i.test(
      rawText || ""
    );

    const needsFollowUp =
      !state.triage_completed &&
      state.missing_information.length > 0 &&
      !state.follow_up_question_asked &&
      (isMultiSystemCluster || isSeekingAdvice);

    let voiceReply = "";

    if (needsFollowUp) {
      const topMissing = state.missing_information[0];
      if (topMissing.includes("duration")) {
        voiceReply = `I understand you are experiencing ${symptomsSummary}. To help guide you to the right care, how long have you had these symptoms, and do you also have a fever?`;
        state.follow_up_question_asked = "duration_and_fever";
      } else if (topMissing.includes("onset")) {
        voiceReply = `I note your ${symptomsSummary}. Did this headache come on suddenly all at once, or has it built up gradually?`;
        state.follow_up_question_asked = "headache_onset";
      } else if (topMissing.includes("trauma")) {
        voiceReply = `I note your ${symptomsSummary}. Did this start following a recent fall or physical injury, or did it begin gradually?`;
        state.follow_up_question_asked = "trauma_history";
      } else {
        voiceReply = `I understand your symptoms of ${symptomsSummary}. Could you tell me how long this has been going on?`;
        state.follow_up_question_asked = "general_duration";
      }

      if (!state.follow_up_history.includes(state.follow_up_question_asked)) {
        state.follow_up_history.push(state.follow_up_question_asked);
      }
    } else {
      state.triage_completed = true;
      const possibilitiesExcerpt =
        possibleCauses.length > 1
          ? `${possibleCauses[0]} or ${possibleCauses[1]}`
          : possibleCauses[0] || "these symptoms";

      voiceReply = `Based on your symptoms of ${symptomsSummary}, several possibilities such as ${possibilitiesExcerpt} could be involved. I recommend an evaluation with our ${specialty} team rather than an unrelated clinic. Would you like me to check available appointment openings with our ${specialty} specialist?`;
    }

    return {
      understood_symptoms: state.symptoms,
      important_missing_information: state.missing_information,
      red_flags: [],
      possible_causes: possibleCauses,
      urgency,
      recommended_specialty: specialty,
      recommended_next_step: `Consultation with ${specialty}`,
      reasoning_basis: reasoningBasis,
      voice_reply: voiceReply,
      isEmergency: false,
      needsFollowUp,
    };
  }
}
