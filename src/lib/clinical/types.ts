/**
 * Clinical Domain Types & Structured Patient State Schema
 * Compliant with PRD Section 20 Clinical Safety Guardrails.
 */

export type PresenceStatus = "PRESENT" | "NEGATED" | "UNCERTAIN" | "UNKNOWN";
export type SeverityLevel = "mild" | "moderate" | "severe" | "unknown";
export type OnsetSpeed = "sudden" | "gradual" | "unknown";

export type OrganSystem =
  | "cardiovascular"
  | "pulmonary"
  | "gastrointestinal"
  | "neurological"
  | "ent"
  | "ophthalmology"
  | "dermatology"
  | "musculoskeletal"
  | "general";

export type TriageUrgency =
  | "EMERGENCY_911"
  | "SAME_DAY_EVALUATION"
  | "ROUTINE_APPOINTMENT"
  | "SELF_CARE_MONITORING";

/**
 * Detailed profile for an individual clinical entity
 */
export interface SymptomProfile {
  conceptId: string;
  standardizedName: string;
  organSystem: OrganSystem;
  status: PresenceStatus;
  severity: SeverityLevel;
  onset: OnsetSpeed;
  duration: string | null;
  location: string | null;
  character: string | null;
  radiation: string | null;
  originalText: string;
  firstReportedTurn: number;
  lastUpdatedTurn: number;
}

/**
 * Structured Patient State maintained across conversation turns
 */
export interface StructuredPatientState {
  age: number | null;
  sex: string | null;
  symptoms: string[]; // Standardized labels of confirmed PRESENT symptoms
  symptomProfiles: Record<string, SymptomProfile>; // Indexed by conceptId
  primary_symptom: string | null;
  onset: string | null;
  duration: string | null;
  severity: "mild" | "moderate" | "severe" | null;
  location: string | null;
  frequency: string | null;
  associated_symptoms: string[];
  medical_history: string[];
  medications: string[];
  allergies: string[];
  recent_events: string[];
  risk_factors: string[];
  red_flags: string[];
  missing_information: string[];
  denied_symptoms: string[]; // Standardized labels of explicitly NEGATED symptoms
  uncertain_symptoms: string[]; // Standardized labels of UNCERTAIN symptoms
  triage_level: TriageUrgency | null;
  follow_up_question_asked: string | null;
  follow_up_history: string[];
  triage_completed: boolean;
  differential_considerations: string[];
}

/**
 * Differential condition possibility with clinical evidence
 */
export interface DifferentialPossibility {
  conditionName: string;
  likelihood: "POSSIBLE" | "CONSIDER" | "LESS_LIKELY";
  primaryOrganSystem: OrganSystem;
  suggestedSpecialty: string;
  evidenceBasis: string;
}

/**
 * Final structured clinical assessment output
 */
export interface ClinicalAssessment {
  understood_symptoms: string[];
  important_missing_information: string[];
  red_flags: string[];
  possible_causes: string[];
  urgency: TriageUrgency;
  recommended_specialty: string;
  recommended_next_step: string;
  reasoning_basis: string;
  voice_reply: string;
  isEmergency: boolean;
  needsFollowUp: boolean;
}

/**
 * Controlled concept definition in medical ontology
 */
export interface ClinicalConcept {
  conceptId: string;
  standardizedName: string;
  organSystem: OrganSystem;
  synonyms: string[];
  phrasingPatterns: RegExp[];
  defaultLocation?: string;
}

/**
 * Deterministic Red-Flag Rule specification
 */
export interface RedFlagRule {
  id: string;
  name: string;
  category: "ACS" | "STROKE_NEURO" | "THUNDERCLAP" | "ACUTE_ABDOMEN" | "ANAPHYLAXIS" | "RESPIRATORY_DISTRESS";
  evaluate: (state: StructuredPatientState, rawText: string) => boolean;
  emergencyGuidance: string;
  clinicalRationale: string;
}
