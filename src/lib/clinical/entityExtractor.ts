import { ClinicalKnowledgeBase } from "./clinicalKnowledgeBase";
import {
  ClinicalConcept,
  OnsetSpeed,
  PresenceStatus,
  SeverityLevel,
  StructuredPatientState,
  SymptomProfile,
} from "./types";

/**
 * Clinical Entity Extraction & Patient State Accumulator
 * 
 * Decouples entity extraction from diagnosis.
 * Captures what the patient reported, detects polarity (PRESENT, NEGATED, UNCERTAIN),
 * extracts clinical attributes (severity, onset, duration, location, radiation, character),
 * and builds a persistent multi-turn structured clinical state.
 */
export class ClinicalEntityExtractor {
  /**
   * Main entry point: Extracts entities from raw user text and merges into StructuredPatientState.
   */
  public static extract(
    text: string,
    existingState?: Partial<StructuredPatientState>,
    turnIndex = 1
  ): StructuredPatientState {
    // Initialize base state
    const state: StructuredPatientState = {
      age: existingState?.age ?? null,
      sex: existingState?.sex ?? null,
      symptoms: [...(existingState?.symptoms || [])],
      symptomProfiles: { ...(existingState?.symptomProfiles || {}) },
      primary_symptom: existingState?.primary_symptom ?? null,
      onset: existingState?.onset ?? null,
      duration: existingState?.duration ?? null,
      severity: existingState?.severity ?? null,
      location: existingState?.location ?? null,
      frequency: existingState?.frequency ?? null,
      associated_symptoms: [...(existingState?.associated_symptoms || [])],
      medical_history: [...(existingState?.medical_history || [])],
      medications: [...(existingState?.medications || [])],
      allergies: [...(existingState?.allergies || [])],
      recent_events: [...(existingState?.recent_events || [])],
      risk_factors: [...(existingState?.risk_factors || [])],
      red_flags: [...(existingState?.red_flags || [])],
      missing_information: [...(existingState?.missing_information || [])],
      denied_symptoms: [...(existingState?.denied_symptoms || [])],
      uncertain_symptoms: [...(existingState?.uncertain_symptoms || [])],
      triage_level: existingState?.triage_level ?? null,
      follow_up_question_asked: existingState?.follow_up_question_asked ?? null,
      follow_up_history: [...(existingState?.follow_up_history || [])],
      triage_completed: existingState?.triage_completed ?? false,
      differential_considerations: [...(existingState?.differential_considerations || [])],
    };

    const lower = text.toLowerCase().trim();

    // 1. Demographics
    this.extractDemographics(lower, state);

    // 2. Global Attributes: Severity, Duration, Onset, Location, Radiation, Character
    this.extractGlobalAttributes(lower, state, existingState);

    // 3. Concept Matching & Polarity Analysis
    this.extractConceptsAndPolarity(text, lower, state, turnIndex);

    // 4. Synthesize symptoms list and primary/associated symptoms
    this.synchronizeSymptomLists(state);

    return state;
  }

  /**
   * Extracts Age and Sex if stated
   */
  private static extractDemographics(lower: string, state: StructuredPatientState): void {
    const ageMatch = lower.match(/\b(\d{1,2})\s*(?:years?\s*old|yo|y\/o)\b/i);
    if (ageMatch) {
      state.age = parseInt(ageMatch[1], 10);
    }

    if (/\b(?:male|man|boy|gentleman)\b/i.test(lower) && !/\b(?:female|woman)\b/i.test(lower)) {
      state.sex = "male";
    } else if (/\b(?:female|woman|girl|lady)\b/i.test(lower)) {
      state.sex = "female";
    }
  }

  /**
   * Extracts Severity, Duration, Onset, Location, Radiation, Character
   */
  private static extractGlobalAttributes(
    lower: string,
    state: StructuredPatientState,
    existingState?: Partial<StructuredPatientState>
  ): void {
    // Severity
    if (/\b(?:severe|intense|unbearable|excruciating|extreme|worst|sharp|terrible|bad)\b/i.test(lower)) {
      state.severity = "severe";
    } else if (/\b(?:moderate|medium|quite)\b/i.test(lower)) {
      state.severity = "moderate";
    } else if (/\b(?:mild|slight|little|minor|low grade)\b/i.test(lower)) {
      state.severity = "mild";
    } else if (existingState?.severity) {
      state.severity = existingState.severity;
    }

    // Duration
    const durationMatch = lower.match(
      /\b(?:for\s+|since\s+)?(\d{1,2}|a\s+few|several)\s+(days?|hours?|weeks?|months?)\b/i
    );
    if (durationMatch) {
      state.duration = durationMatch[0];
    } else if (lower.includes("since yesterday") || lower.includes("yesterday")) {
      state.duration = "since yesterday";
    } else if (lower.includes("since this morning") || lower.includes("this morning") || lower.includes("today")) {
      state.duration = "since this morning";
    } else if (lower.includes("just now") || lower.includes("a few minutes ago")) {
      state.duration = "just now";
    } else if (existingState?.duration) {
      state.duration = existingState.duration;
    }

    // Onset Speed
    if (/\b(?:sudden|suddenly|abrupt|abruptly|all of a sudden|thunderclap|acute)\b/i.test(lower)) {
      state.onset = "sudden";
    } else if (/\b(?:gradual|gradually|slowly|over time|built up)\b/i.test(lower)) {
      state.onset = "gradual";
    } else if (existingState?.onset) {
      state.onset = existingState.onset;
    }

    // Location
    if (/\b(?:stomach|abdomen|belly|gut|epigastric)\b/i.test(lower)) {
      state.location = "abdomen / stomach";
    } else if (/\b(?:head|temples|forehead|cranial)\b/i.test(lower)) {
      state.location = "head";
    } else if (/\b(?:chest|sternum)\b/i.test(lower)) {
      state.location = "chest";
    } else if (/\b(?:ear|ears)\b/i.test(lower)) {
      state.location = "ear";
    } else if (/\b(?:throat)\b/i.test(lower)) {
      state.location = "throat";
    } else if (/\b(?:knee|knees)\b/i.test(lower)) {
      state.location = "knee";
    } else if (/\b(?:shoulder|shoulders)\b/i.test(lower)) {
      state.location = "shoulder";
    } else if (/\b(?:back|lower back|spine)\b/i.test(lower)) {
      state.location = "back";
    } else if (/\b(?:eye|eyes)\b/i.test(lower)) {
      state.location = "eye";
    } else if (/\b(?:skin|cutaneous)\b/i.test(lower)) {
      state.location = "skin";
    } else if (existingState?.location) {
      state.location = existingState.location;
    }

    // Radiation
    const radMatch = lower.match(/radiat(?:ing|es)?\s+(?:down|to|into)\s+(?:my\s+)?([a-z\s]+?)(?:,|\.|\s+with|\s+and|$)/i);
    if (radMatch) {
      const radiationTarget = radMatch[1].trim();
      if (!state.risk_factors.includes(`radiation: ${radiationTarget}`)) {
        state.risk_factors.push(`radiation: ${radiationTarget}`);
      }
    }
  }

  /**
   * Concept Matching & Polarity Analysis
   */
  private static extractConceptsAndPolarity(
    rawText: string,
    lower: string,
    state: StructuredPatientState,
    turnIndex: number
  ): void {
    // 1. Explicit Negation Detection across common clinical entities
    const explicitNegations: Array<{ label: string; conceptId: string; regex: RegExp }> = [
      {
        label: "fever",
        conceptId: "fever",
        regex: /\b(?:no|not|without|negative for|neither|haven\'t had (?:a|any)?|don\'t have (?:a|any)?)\s+(?:fever|temperature|chills)\b/i,
      },
      {
        label: "vomiting",
        conceptId: "vomiting",
        regex: /\b(?:no|not|without|haven\'t|haven\'t had (?:a|any)?|haven\'t vomited|not vomited)\s+(?:vomiting|vomit|throwing up|puking)\b/i,
      },
      {
        label: "chest pain",
        conceptId: "chest_pain_discomfort",
        regex: /\b(?:no|not|without)\s+(?:chest pain|chest pressure|chest discomfort)\b/i,
      },
      {
        label: "headache",
        conceptId: "headache",
        regex: /\b(?:no|not|without)\s+(?:headache|headaches|migraine)\b/i,
      },
      {
        label: "rash",
        conceptId: "skin_rash",
        regex: /\b(?:no|not|without)\s+(?:rash|rashes|skin eruption)\b/i,
      },
      {
        label: "diarrhea",
        conceptId: "diarrhea",
        regex: /\b(?:no|not|without)\s+(?:diarrhea|diarrhoea|loose stools?)\b/i,
      },
      {
        label: "shortness of breath",
        conceptId: "dyspnea",
        regex: /\b(?:no|not|without)\s+(?:shortness of breath|trouble breathing|breathing difficulty)\b/i,
      },
    ];

    for (const neg of explicitNegations) {
      if (neg.regex.test(lower)) {
        if (!state.denied_symptoms.includes(neg.label)) {
          state.denied_symptoms.push(neg.label);
        }
        // Update or create profile as NEGATED
        state.symptomProfiles[neg.conceptId] = {
          conceptId: neg.conceptId,
          standardizedName: neg.label,
          organSystem: this.getOrganSystemForConcept(neg.conceptId),
          status: "NEGATED",
          severity: "unknown",
          onset: "unknown",
          duration: null,
          location: null,
          character: null,
          radiation: null,
          originalText: rawText,
          firstReportedTurn: state.symptomProfiles[neg.conceptId]?.firstReportedTurn ?? turnIndex,
          lastUpdatedTurn: turnIndex,
        };
      }
    }

    // 2. Iterate all controlled concepts in Knowledge Base
    for (const concept of ClinicalKnowledgeBase.CONCEPTS) {
      const matchResult = this.evaluateConceptMatch(lower, concept);
      if (!matchResult.matched) continue;

      const isExplicitlyDenied =
        state.denied_symptoms.includes(concept.standardizedName) ||
        (concept.conceptId === "fever" && state.denied_symptoms.includes("fever")) ||
        (concept.conceptId === "vomiting" && state.denied_symptoms.includes("vomiting")) ||
        (concept.conceptId === "chest_pain_discomfort" && state.denied_symptoms.includes("chest pain"));

      if (isExplicitlyDenied) {
        continue;
      }

      // Check context window for negation or uncertainty
      const status = this.determinePolarity(lower, matchResult.matchIndex, matchResult.matchedText);

      if (status === "NEGATED") {
        if (!state.denied_symptoms.includes(concept.standardizedName)) {
          state.denied_symptoms.push(concept.standardizedName);
        }
        state.symptomProfiles[concept.conceptId] = {
          conceptId: concept.conceptId,
          standardizedName: concept.standardizedName,
          organSystem: concept.organSystem,
          status: "NEGATED",
          severity: "unknown",
          onset: "unknown",
          duration: null,
          location: concept.defaultLocation || null,
          character: null,
          radiation: null,
          originalText: matchResult.matchedText,
          firstReportedTurn: state.symptomProfiles[concept.conceptId]?.firstReportedTurn ?? turnIndex,
          lastUpdatedTurn: turnIndex,
        };
      } else if (status === "UNCERTAIN") {
        if (!state.uncertain_symptoms.includes(concept.standardizedName)) {
          state.uncertain_symptoms.push(concept.standardizedName);
        }
        state.symptomProfiles[concept.conceptId] = {
          conceptId: concept.conceptId,
          standardizedName: concept.standardizedName,
          organSystem: concept.organSystem,
          status: "UNCERTAIN",
          severity: (state.severity as SeverityLevel) || "unknown",
          onset: (state.onset as OnsetSpeed) || "unknown",
          duration: state.duration,
          location: concept.defaultLocation || state.location,
          character: null,
          radiation: null,
          originalText: matchResult.matchedText,
          firstReportedTurn: state.symptomProfiles[concept.conceptId]?.firstReportedTurn ?? turnIndex,
          lastUpdatedTurn: turnIndex,
        };
      } else {
        // PRESENT
        const existingProfile = state.symptomProfiles[concept.conceptId];
        state.symptomProfiles[concept.conceptId] = {
          conceptId: concept.conceptId,
          standardizedName: concept.standardizedName,
          organSystem: concept.organSystem,
          status: "PRESENT",
          severity: (state.severity as SeverityLevel) || existingProfile?.severity || "unknown",
          onset: (state.onset as OnsetSpeed) || existingProfile?.onset || "unknown",
          duration: state.duration || existingProfile?.duration || null,
          location: concept.defaultLocation || state.location || existingProfile?.location || null,
          character: null,
          radiation: null,
          originalText: matchResult.matchedText,
          firstReportedTurn: existingProfile?.firstReportedTurn ?? turnIndex,
          lastUpdatedTurn: turnIndex,
        };
      }
    }
  }

  /**
   * Checks if concept patterns match in text and returns the earliest match
   */
  private static evaluateConceptMatch(
    lower: string,
    concept: ClinicalConcept
  ): { matched: boolean; matchIndex: number; matchedText: string } {
    let earliestIndex = -1;
    let bestMatchText = "";

    for (const pattern of concept.phrasingPatterns) {
      const match = pattern.exec(lower);
      if (match) {
        if (earliestIndex === -1 || match.index < earliestIndex) {
          earliestIndex = match.index;
          bestMatchText = match[0];
        }
      }
    }

    if (earliestIndex !== -1) {
      return { matched: true, matchIndex: earliestIndex, matchedText: bestMatchText };
    }

    // Fallback: check synonyms
    for (const syn of concept.synonyms) {
      const idx = lower.indexOf(syn.toLowerCase());
      if (idx !== -1) {
        if (earliestIndex === -1 || idx < earliestIndex) {
          earliestIndex = idx;
          bestMatchText = syn;
        }
      }
    }

    return earliestIndex !== -1
      ? { matched: true, matchIndex: earliestIndex, matchedText: bestMatchText }
      : { matched: false, matchIndex: -1, matchedText: "" };
  }

  /**
   * Evaluates preceding window for negation or uncertainty markers
   */
  private static determinePolarity(
    lower: string,
    matchIndex: number,
    _matchedText: string
  ): PresenceStatus {
    // Look back up to 40 characters before match
    const windowStart = Math.max(0, matchIndex - 40);
    const preWindow = lower.substring(windowStart, matchIndex);

    // Negation checks
    const negationRegex = /\b(?:no|not|without|denies|negative for|neither|haven\'t had|haven\'t|hasn\'t had|zero|free of|definitely no)(?:\s+(?:a|any|much))?\s*$/i;
    if (negationRegex.test(preWindow.trimEnd())) {
      return "NEGATED";
    }

    // Uncertainty checks
    const uncertaintyRegex = /\b(?:maybe|might have|might be|not sure if|possibly|perhaps|unclear if|wondering if)(?:\s+(?:a|any|some))?\s*$/i;
    if (uncertaintyRegex.test(preWindow.trimEnd())) {
      return "UNCERTAIN";
    }

    return "PRESENT";
  }

  /**
   * Synchronizes state.symptoms, primary_symptom, and associated_symptoms
   * strictly from symptomProfiles with status: "PRESENT".
   */
  private static synchronizeSymptomLists(state: StructuredPatientState): void {
    const presentLabels: string[] = [];

    // Order by first reported turn
    const presentProfiles = Object.values(state.symptomProfiles)
      .filter((p) => p.status === "PRESENT")
      .sort((a, b) => a.firstReportedTurn - b.firstReportedTurn);

    for (const p of presentProfiles) {
      if (!presentLabels.includes(p.standardizedName)) {
        presentLabels.push(p.standardizedName);
      }
    }

    // Ensure denied symptoms are removed from symptoms list
    state.symptoms = presentLabels.filter((s) => !state.denied_symptoms.includes(s));

    // Primary symptom is the first present symptom
    state.primary_symptom = state.symptoms.length > 0 ? state.symptoms[0] : null;

    // Associated symptoms are secondary present symptoms
    state.associated_symptoms = state.symptoms.slice(1);
  }

  private static getOrganSystemForConcept(conceptId: string) {
    const concept = ClinicalKnowledgeBase.CONCEPTS.find((c) => c.conceptId === conceptId);
    return concept?.organSystem || "general";
  }
}
