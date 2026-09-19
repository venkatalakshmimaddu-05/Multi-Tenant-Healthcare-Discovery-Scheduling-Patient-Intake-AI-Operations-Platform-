/**
 * Clinical Triage & Medical Symptom Assessment Engine (Façade)
 * 
 * Implements the cautious multi-stage clinical reasoning pipeline:
 * Patient Input -> Clinical Entity Extraction -> Structured Patient State ->
 * Red-Flag Screening -> Missing-Information Detection -> Multi-System Differential ->
 * Dynamic Follow-Up Selection -> Urgency/Triage Scoring -> Structured Voice Output.
 * 
 * Compliant with PRD Section 20 Clinical Safety Guardrails.
 * Delegates to modular domain implementations in src/lib/clinical/.
 */

import { ClinicalEntityExtractor } from "../clinical/entityExtractor";
import { RedFlagSafetyLayer } from "../clinical/redFlagSafety";
import { DifferentialEngine, MissingInformationEngine } from "../clinical/triageReasoning";
import { ClinicalAssessment, StructuredPatientState } from "../clinical/types";

export type { ClinicalAssessment, StructuredPatientState } from "../clinical/types";

export class ClinicalTriageEngine {
  /**
   * Initializes a blank structured patient state.
   */
  public static createInitialState(): StructuredPatientState {
    return {
      age: null,
      sex: null,
      symptoms: [],
      symptomProfiles: {},
      primary_symptom: null,
      onset: null,
      duration: null,
      severity: null,
      location: null,
      frequency: null,
      associated_symptoms: [],
      medical_history: [],
      medications: [],
      allergies: [],
      recent_events: [],
      risk_factors: [],
      red_flags: [],
      missing_information: [],
      denied_symptoms: [],
      uncertain_symptoms: [],
      triage_level: null,
      follow_up_question_asked: null,
      follow_up_history: [],
      triage_completed: false,
      differential_considerations: [],
    };
  }

  /**
   * Stage 1 & 2: Clinical Entity Extraction & Structured State Accumulation
   * Decoupled from diagnosis; extracts polarity (PRESENT, NEGATED, UNCERTAIN)
   * and clinical attributes (severity, duration, onset, location).
   */
  public static extractAndAccumulate(
    text: string,
    existingState?: Partial<StructuredPatientState>,
    turnIndex?: number
  ): StructuredPatientState {
    return ClinicalEntityExtractor.extract(text, existingState, turnIndex);
  }

  /**
   * Stage 3: Deterministic Red-Flag & Emergency Rule Screening
   * Evaluates ACS, Stroke, Thunderclap, Acute Abdomen, and Airway compromise.
   * Runs prior to routine differential formulation.
   */
  public static evaluateRedFlags(state: StructuredPatientState, rawText: string): string[] {
    return RedFlagSafetyLayer.evaluate(state, rawText);
  }

  /**
   * Stage 4: Missing-Information Detection
   * Prioritized by clinical necessity: Emergency risk > Differential discrimination > Care level.
   */
  public static detectMissingInformation(state: StructuredPatientState): string[] {
    return MissingInformationEngine.detect(state);
  }

  /**
   * Stage 5 & 6: Multi-System Differential & Specialty Recommendation
   * Expresses clinical uncertainty ("possible considerations include..."),
   * selects single follow-up question if needed, and maps to correct care pathway.
   */
  public static computeDifferentialAndSpecialty(
    state: StructuredPatientState,
    redFlags: string[],
    rawText?: string
  ): ClinicalAssessment {
    return DifferentialEngine.formulate(state, redFlags, rawText);
  }
}