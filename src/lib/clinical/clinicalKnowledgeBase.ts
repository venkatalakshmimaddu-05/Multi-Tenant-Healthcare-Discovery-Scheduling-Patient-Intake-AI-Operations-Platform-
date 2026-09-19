import {
  ClinicalConcept,
  DifferentialPossibility,
  OrganSystem,
  RedFlagRule,
  StructuredPatientState,
} from "./types";

/**
 * Controlled Medical Knowledge Base
 * 
 * Maintained independently from UI and application logic.
 * Encodes medically reviewed clinical concepts, red-flag criteria,
 * differential profiles, and specialty routing taxonomies.
 */
export class ClinicalKnowledgeBase {
  /**
   * Standardized Clinical Concepts & Natural-Language Synonyms
   */
  public static readonly CONCEPTS: ClinicalConcept[] = [
    // --- GASTROINTESTINAL ---
    {
      conceptId: "abdominal_pain",
      standardizedName: "stomach pain",
      organSystem: "gastrointestinal",
      synonyms: ["stomach pain", "stomach ache", "belly ache", "tummy ache", "abdominal cramps", "stomach cramps", "belly in knots", "gut pain", "epigastric pain", "hurting in stomach"],
      phrasingPatterns: [
        /\b(?:stomach|abdominal|belly|tummy|gut)\s*(?:pain|ache|aching|cramp|cramps|cramping|discomfort|hurts?|hurting|spasms?|in knots)\b/i,
        /\b(?:pain|cramps?|ache)\s+(?:in|around)\s+(?:my\s+)?(?:stomach|abdomen|belly|gut)\b/i,
      ],
      defaultLocation: "abdomen / stomach",
    },
    {
      conceptId: "nausea",
      standardizedName: "nausea",
      organSystem: "gastrointestinal",
      synonyms: ["nauseous", "nauseated", "fell nausease", "feeling sick", "queasy", "sick to my stomach", "upset stomach"],
      phrasingPatterns: [
        /\b(?:nausea|nauseous|nauseated|fell nausease|queasy|feeling sick|sick to my stomach|upset stomach)\b/i,
      ],
    },
    {
      conceptId: "vomiting",
      standardizedName: "vomiting",
      organSystem: "gastrointestinal",
      synonyms: ["vomit", "throwing up", "threw up", "puking", "puked", "emesis"],
      phrasingPatterns: [
        /\b(?:vomit|vomiting|threw up|throwing up|puke|puking|emesis)\b/i,
      ],
    },
    {
      conceptId: "diarrhea",
      standardizedName: "diarrhea",
      organSystem: "gastrointestinal",
      synonyms: ["diarrhoea", "loose stools", "runny stools", "watery stools", "frequent bowel movements"],
      phrasingPatterns: [
        /\b(?:diarrhea|diarrhoea|loose stools?|runny stools?|watery stools?)\b/i,
      ],
    },
    {
      conceptId: "acid_reflux",
      standardizedName: "acid reflux / heartburn",
      organSystem: "gastrointestinal",
      synonyms: ["heartburn", "gerd", "indigestion", "acid burning", "burning in chest after eating", "sour stomach"],
      phrasingPatterns: [
        /\b(?:acid reflux|heartburn|indigestion|gerd|acid regurgitation|burning in stomach)\b/i,
      ],
    },
    {
      conceptId: "constipation",
      standardizedName: "constipation",
      organSystem: "gastrointestinal",
      synonyms: ["constipated", "cannot poop", "hard stools", "infrequent bowel movements"],
      phrasingPatterns: [
        /\b(?:constipat(?:ion|ed)|cannot poop|can\'t poop|hard stools?)\b/i,
      ],
    },

    // --- NEUROLOGICAL & HEAD ---
    {
      conceptId: "headache",
      standardizedName: "headache",
      organSystem: "neurological",
      synonyms: ["head ache", "migraine", "head throbbing", "head pressure", "head pounding", "head hurts", "pain in head"],
      phrasingPatterns: [
        /\b(?:headaches?|head ache|migraines?|head throbbing|head pressure|head pounding|head hurts?|pain in (?:my\s+)?head)\b/i,
      ],
      defaultLocation: "head",
    },
    {
      conceptId: "dizziness_vertigo",
      standardizedName: "dizziness / vertigo",
      organSystem: "neurological",
      synonyms: ["dizzy", "vertigo", "lightheaded", "room spinning", "loss of balance", "unsteady"],
      phrasingPatterns: [
        /\b(?:dizzy|dizziness|vertigo|lightheaded|lightheadedness|room spinning|spinning sensation|unsteady on feet)\b/i,
      ],
    },
    {
      conceptId: "numbness_tingling",
      standardizedName: "numbness / tingling",
      organSystem: "neurological",
      synonyms: ["pins and needles", "tingling", "numb", "loss of sensation", "neuropathy", "paresthesia"],
      phrasingPatterns: [
        /\b(?:numbness|numb|tingling|pins and needles|neuropathy|loss of sensation)\b/i,
      ],
    },
    {
      conceptId: "tremor_shaking",
      standardizedName: "tremor / shaking",
      organSystem: "neurological",
      synonyms: ["shaking hands", "tremors", "shaky", "involuntary shaking"],
      phrasingPatterns: [
        /\b(?:tremor|tremors|shaking hands?|shaky hands?)\b/i,
      ],
    },

    // --- CARDIOVASCULAR ---
    {
      conceptId: "chest_pain_discomfort",
      standardizedName: "chest pain",
      organSystem: "cardiovascular",
      synonyms: ["chest tightness", "chest pressure", "something squeezing my chest", "tightness around my chest", "heavy weight on chest", "angina"],
      phrasingPatterns: [
        /\b(?:chest\s*(?:pain|tightness|pressure|discomfort|heaviness|squeezing)|something squeezing (?:my\s+)?chest|tightness around (?:my\s+)?chest|heavy weight on (?:my\s+)?chest|crushing chest|angina)\b/i,
        /\b(?:pain|tightness|pressure|squeezing)\s+(?:in|around|across)\s+(?:my\s+)?chest\b/i,
      ],
      defaultLocation: "chest",
    },
    {
      conceptId: "palpitations",
      standardizedName: "palpitations",
      organSystem: "cardiovascular",
      synonyms: ["racing heart", "fluttering heart", "irregular heartbeat", "skipped beats", "heart pounding"],
      phrasingPatterns: [
        /\b(?:palpitation|palpitations|racing heart|fluttering heart|irregular heartbeat|skipped beats?|heart pounding|heart racing)\b/i,
      ],
    },
    {
      conceptId: "dyspnea",
      standardizedName: "shortness of breath",
      organSystem: "cardiovascular",
      synonyms: ["trouble breathing", "difficulty breathing", "breathless", "can't catch breath", "hard to breathe"],
      phrasingPatterns: [
        /\b(?:shortness of breath|trouble breathing|difficulty breathing|breathless|can\'t catch (?:my\s+)?breath|hard to breathe|dyspnea)\b/i,
      ],
    },

    // --- PULMONARY ---
    {
      conceptId: "cough",
      standardizedName: "cough",
      organSystem: "pulmonary",
      synonyms: ["coughing", "persistent cough", "dry cough", "productive cough"],
      phrasingPatterns: [
        /\b(?:cough|coughing|persistent cough|dry cough|hacking cough)\b/i,
      ],
    },
    {
      conceptId: "wheezing",
      standardizedName: "wheezing",
      organSystem: "pulmonary",
      synonyms: ["wheeze", "whistling sound when breathing", "asthma flare"],
      phrasingPatterns: [
        /\b(?:wheezing|wheeze|whistling (?:sound|breath)|asthma flare)\b/i,
      ],
    },

    // --- ENT (Otolaryngology) ---
    {
      conceptId: "ear_pain",
      standardizedName: "ear pain / ear problem",
      organSystem: "ent",
      synonyms: ["earache", "ear ache", "ear hurting", "clogged ear", "blocked ear", "water in ear", "water went into ear", "swimmer's ear", "ear infection", "tinnitus", "ringing in ear"],
      phrasingPatterns: [
        /\b(?:ear(?:\s+is)?\s*(?:pain|ache|aching|hurts?|hurting|problem|issue)|earache|ear ache|clogged ear|blocked ear|water\s+(?:went\s+into|in)\s+(?:my\s+)?ear|swimmer\'s ear|swimmer ear|ear infection|ringing in (?:my\s+)?ear|tinnitus)\b/i,
      ],
      defaultLocation: "ear",
    },
    {
      conceptId: "hearing_changes",
      standardizedName: "hearing changes",
      organSystem: "ent",
      synonyms: ["muffled hearing", "hearing loss", "hard of hearing", "can't hear well"],
      phrasingPatterns: [
        /\b(?:hearing loss|muffled(?:\s+hearing)?|hard of hearing|can\'t hear|cannot hear)\b/i,
      ],
    },
    {
      conceptId: "sore_throat",
      standardizedName: "sore throat",
      organSystem: "ent",
      synonyms: ["throat pain", "scratchy throat", "tonsillitis", "strep throat", "hurts to swallow"],
      phrasingPatterns: [
        /\b(?:sore throat|throat pain|scratchy throat|tonsil|tonsillitis|strep throat|hurts? to swallow)\b/i,
      ],
      defaultLocation: "throat",
    },
    {
      conceptId: "sinus_congestion",
      standardizedName: "sinus congestion",
      organSystem: "ent",
      synonyms: ["sinusitis", "sinus pressure", "stuffy nose", "nasal congestion", "runny nose"],
      phrasingPatterns: [
        /\b(?:sinus|sinusitis|sinus pressure|stuffy nose|nasal congestion|runny nose|blocked nose)\b/i,
      ],
    },

    // --- OPHTHALMOLOGY ---
    {
      conceptId: "eye_pain_redness",
      standardizedName: "eye pain / redness",
      organSystem: "ophthalmology",
      synonyms: ["red eye", "pink eye", "eye irritation", "stye", "swollen eyelid", "pain in eye"],
      phrasingPatterns: [
        /\b(?:eye\s*(?:pain|redness|irritation|infection)|red eyes?|pink eye|conjunctivitis|stye|swollen eyelid|pain in (?:my\s+)?eye)\b/i,
      ],
      defaultLocation: "eye",
    },
    {
      conceptId: "vision_changes",
      standardizedName: "blurry vision",
      organSystem: "ophthalmology",
      synonyms: ["blurry vision", "blurred vision", "double vision", "loss of vision", "can't see clearly"],
      phrasingPatterns: [
        /\b(?:blurry vision|blurred vision|double vision|vision loss|can\'t see|cannot see clearly|loss of vision)\b/i,
      ],
    },

    // --- DERMATOLOGY ---
    {
      conceptId: "skin_rash",
      standardizedName: "skin rash",
      organSystem: "dermatology",
      synonyms: ["rashes", "eczema", "hives", "dermatitis", "itchy rash", "red bumps on skin", "skinny lashes"],
      phrasingPatterns: [
        /\b(?:skin rash|rash|rashes|skinny lashes|eczema|hives?|dermatitis|urticaria|skin eruption|red bumps? on skin)\b/i,
      ],
      defaultLocation: "skin",
    },
    {
      conceptId: "skin_itching_lesion",
      standardizedName: "skin itching / lesions",
      organSystem: "dermatology",
      synonyms: ["itchy skin", "blister", "mole changes", "skin growth"],
      phrasingPatterns: [
        /\b(?:itchy skin|itch|itching|skin itching|blister|blisters|mole|moles|skin lesions?)\b/i,
      ],
    },

    // --- MUSCULOSKELETAL ---
    {
      conceptId: "joint_pain",
      standardizedName: "joint / knee pain",
      organSystem: "musculoskeletal",
      synonyms: ["knee pain", "shoulder pain", "ankle pain", "wrist pain", "hip pain", "swollen joint", "joint stiffness"],
      phrasingPatterns: [
        /\b(?:knee|knees|shoulder|elbow|ankle|wrist|hip|joint|joints)\s*(?:pain|ache|aching|swelling|swollen|hurts?|stiff|sprain)\b/i,
      ],
    },
    {
      conceptId: "back_pain",
      standardizedName: "back pain",
      organSystem: "musculoskeletal",
      synonyms: ["lower back pain", "spine pain", "lumbago", "sciatica"],
      phrasingPatterns: [
        /\b(?:back pain|lower back|spine pain|sciatica|lumbago)\b/i,
      ],
      defaultLocation: "back",
    },

    // --- CONSTITUTIONAL / GENERAL ---
    {
      conceptId: "fever",
      standardizedName: "fever / chills",
      organSystem: "general",
      synonyms: ["high temperature", "chills", "feverish", "shivering", "burning up"],
      phrasingPatterns: [
        /\b(?:fever|high temperature|chills|shivering|feverish|burning up)\b/i,
      ],
    },
    {
      conceptId: "fatigue",
      standardizedName: "fatigue / weakness",
      organSystem: "general",
      synonyms: ["exhaustion", "lethargic", "run down", "no energy", "body weakness"],
      phrasingPatterns: [
        /\b(?:fatigue|exhausted|exhaustion|weakness|lethargic|no energy|run down)\b/i,
      ],
    },
  ];

  /**
   * Deterministic Red-Flag Safety Rules
   */
  public static readonly RED_FLAG_RULES: RedFlagRule[] = [
    {
      id: "RF_ACS",
      name: "Suspected Acute Coronary Syndrome",
      category: "ACS",
      clinicalRationale: "Crushing chest discomfort radiating to left arm/jaw or accompanied by dyspnea/diaphoresis suggests myocardial ischemia.",
      emergencyGuidance: "Call 911 or go to the nearest emergency room immediately.",
      evaluate: (state, rawText) => {
        const text = rawText.toLowerCase();
        const hasChest = Boolean(state.symptomProfiles["chest_pain_discomfort"]?.status === "PRESENT");
        const hasDyspnea = Boolean(state.symptomProfiles["dyspnea"]?.status === "PRESENT");
        const isCrushing = text.includes("crushing") || text.includes("pressure") || text.includes("squeezing");
        const hasRadiation = text.includes("radiat") || text.includes("left arm") || text.includes("jaw") || text.includes("shoulder blade");
        return (
          (hasChest && (hasRadiation || (isCrushing && state.severity === "severe") || (hasDyspnea && state.severity === "severe"))) ||
          (text.includes("chest") && text.includes("crushing") && hasRadiation)
        );
      },
    },
    {
      id: "RF_STROKE",
      name: "Suspected Acute Neurological / Stroke Event",
      category: "STROKE_NEURO",
      clinicalRationale: "Sudden focal neurological deficits (facial droop, speech impairment, unilateral weakness) meet emergency FAST criteria.",
      emergencyGuidance: "Call 911 immediately. Note the time symptoms began for emergency responders.",
      evaluate: (state, rawText) => {
        const text = rawText.toLowerCase();
        return (
          text.includes("facial droop") ||
          text.includes("slurred speech") ||
          text.includes("cannot move arm") ||
          text.includes("cannot move leg") ||
          text.includes("one side of my body") ||
          text.includes("loss of speech") ||
          (text.includes("sudden") && text.includes("vision loss") && text.includes("numbness"))
        );
      },
    },
    {
      id: "RF_THUNDERCLAP",
      name: "Potential Neurological Emergency / Suspected Thunderclap Headache / Subarachnoid Hemorrhage",
      category: "THUNDERCLAP",
      clinicalRationale: "A sudden, maximum-intensity headache peaking in seconds ('worst headache of life') warrants immediate rule-out of intracranial bleed.",
      emergencyGuidance: "Go to the nearest emergency department or call 911 immediately.",
      evaluate: (state, rawText) => {
        const text = rawText.toLowerCase();
        const isHeadache = Boolean(state.symptomProfiles["headache"]?.status === "PRESENT");
        const isThunderclap = text.includes("thunderclap") || text.includes("worst headache of my life") || text.includes("worst headache ever");
        const isSuddenSevere = isHeadache && state.onset === "sudden" && state.severity === "severe";
        return isThunderclap || isSuddenSevere;
      },
    },
    {
      id: "RF_ACUTE_ABDOMEN",
      name: "Acute Surgical Abdomen / Gastrointestinal Hemorrhage",
      category: "ACUTE_ABDOMEN",
      clinicalRationale: "Hematemesis, melena, or severe abdominal rigidity indicate acute intra-abdominal hemorrhage or peritonitis.",
      emergencyGuidance: "Proceed immediately to an emergency department.",
      evaluate: (state, rawText) => {
        const text = rawText.toLowerCase();
        const isStomach = Boolean(state.symptomProfiles["abdominal_pain"]?.status === "PRESENT");
        const isBleeding =
          text.includes("vomiting blood") ||
          text.includes("throwing up blood") ||
          text.includes("black tarry stool") ||
          text.includes("blood in vomit");
        const isPeritoneal =
          isStomach &&
          state.severity === "severe" &&
          (text.includes("rigid") || text.includes("cannot touch") || text.includes("passed out") || text.includes("fainted"));
        return isBleeding || isPeritoneal;
      },
    },
    {
      id: "RF_AIRWAY_ANAPHYLAXIS",
      name: "Impending Airway Compromise / Anaphylaxis",
      category: "ANAPHYLAXIS",
      clinicalRationale: "Rapid-onset swelling of lips, tongue, or pharynx with breathing compromise requires immediate epinephrine and emergency care.",
      emergencyGuidance: "Call 911 immediately. If you have an epinephrine auto-injector, use it now.",
      evaluate: (state, rawText) => {
        const text = rawText.toLowerCase();
        return (
          text.includes("throat closing") ||
          text.includes("lips swelling") ||
          text.includes("tongue swelling") ||
          text.includes("cannot swallow saliva") ||
          (text.includes("difficulty breathing") && text.includes("swelling") && text.includes("rash"))
        );
      },
    },
  ];

  /**
   * Evaluates Multi-System Differential Possibilities
   */
  public static evaluateDifferential(state: StructuredPatientState): {
    possibilities: DifferentialPossibility[];
    recommendedSpecialty: string;
    urgency: "EMERGENCY_911" | "SAME_DAY_EVALUATION" | "ROUTINE_APPOINTMENT" | "SELF_CARE_MONITORING";
    reasoningBasis: string;
  } {
    const present = Object.values(state.symptomProfiles).filter((s) => s.status === "PRESENT");
    const presentIds = new Set(present.map((s) => s.conceptId));
    const isSevere = state.severity === "severe";

    const hasStomach = presentIds.has("abdominal_pain") || presentIds.has("nausea") || presentIds.has("vomiting") || presentIds.has("diarrhea");
    const hasHeadache = presentIds.has("headache");
    const hasNeuro = presentIds.has("numbness_tingling") || presentIds.has("dizziness_vertigo") || presentIds.has("tremor_shaking");
    const hasChest = presentIds.has("chest_pain_discomfort") || presentIds.has("palpitations");
    const hasEar = presentIds.has("ear_pain") || presentIds.has("hearing_changes");
    const hasThroat = presentIds.has("sore_throat") || presentIds.has("sinus_congestion");
    const hasEye = presentIds.has("eye_pain_redness") || presentIds.has("vision_changes");
    const hasSkin = presentIds.has("skin_rash") || presentIds.has("skin_itching_lesion");
    const hasJoint = presentIds.has("joint_pain") || presentIds.has("back_pain");

    // Case 1: Multi-System Gastrointestinal Cluster (Stomach + Headache / Nausea)
    if (hasStomach && hasHeadache) {
      return {
        possibilities: [
          {
            conditionName: "Acute viral gastroenteritis with dehydration headache",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "gastrointestinal",
            suggestedSpecialty: isSevere ? "Gastroenterology" : "General Medicine",
            evidenceBasis: "Combination of gastrointestinal symptoms with secondary cephalalgia, often reflecting dehydration or systemic inflammatory response.",
          },
          {
            conditionName: "Foodborne illness / food poisoning",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "gastrointestinal",
            suggestedSpecialty: isSevere ? "Gastroenterology" : "General Medicine",
            evidenceBasis: "Acute abdominal cramps, nausea, and headache following ingestion of contaminated food.",
          },
          {
            conditionName: "Abdominal migraine / autonomic cephalalgia",
            likelihood: "CONSIDER",
            primaryOrganSystem: "neurological",
            suggestedSpecialty: "Neurology",
            evidenceBasis: "Co-occurring abdominal distress and migraine-spectrum symptoms.",
          },
        ],
        recommendedSpecialty: isSevere ? "Gastroenterology" : "General Medicine",
        urgency: isSevere ? "SAME_DAY_EVALUATION" : "ROUTINE_APPOINTMENT",
        reasoningBasis: "Abdominal pain, nausea, and headache strongly point to gastrointestinal or systemic etiology. Otolaryngology (ENT) is clinically unrelated to abdominal complaints.",
      };
    }

    // Case 2: Isolated Gastrointestinal Presentation
    if (hasStomach) {
      return {
        possibilities: [
          {
            conditionName: "Acute gastritis / peptic irritation",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "gastrointestinal",
            suggestedSpecialty: isSevere ? "Gastroenterology" : "General Medicine",
            evidenceBasis: "Localized gastric discomfort and dyspepsia.",
          },
          {
            conditionName: "Functional dyspepsia / gastrointestinal infection",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "gastrointestinal",
            suggestedSpecialty: isSevere ? "Gastroenterology" : "General Medicine",
            evidenceBasis: "Non-specific abdominal cramping and nausea.",
          },
        ],
        recommendedSpecialty: isSevere ? "Gastroenterology" : "General Medicine",
        urgency: isSevere ? "SAME_DAY_EVALUATION" : "ROUTINE_APPOINTMENT",
        reasoningBasis: "Abdominal discomfort and digestive symptoms are managed by Gastroenterology or General Practice. Otolaryngology (ENT) is clinically unrelated to abdominal complaints.",
      };
    }

    // Case 3: Localized ENT (Otolaryngology) Presentation
    if (hasEar || (hasThroat && !hasStomach)) {
      return {
        possibilities: [
          {
            conditionName: "Otitis media or otitis externa (swimmer's ear)",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "ent",
            suggestedSpecialty: "ENT (Otolaryngology)",
            evidenceBasis: "Direct ear canal pain, water retention, or muffled hearing.",
          },
          {
            conditionName: "Acute rhinosinusitis / pharyngitis",
            likelihood: "CONSIDER",
            primaryOrganSystem: "ent",
            suggestedSpecialty: "ENT (Otolaryngology)",
            evidenceBasis: "Upper airway and sinus tract inflammation.",
          },
        ],
        recommendedSpecialty: "ENT (Otolaryngology)",
        urgency: "ROUTINE_APPOINTMENT",
        reasoningBasis: "Localized ear, sinus, or throat symptoms fall within the clinical scope of Otolaryngology (ENT).",
      };
    }

    // Case 4: Ophthalmology
    if (hasEye) {
      return {
        possibilities: [
          {
            conditionName: "Acute conjunctivitis / ocular irritation",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "ophthalmology",
            suggestedSpecialty: "Ophthalmology",
            evidenceBasis: "Ocular redness, discharge, or discomfort.",
          },
          {
            conditionName: "Refractive or visual strain",
            likelihood: "CONSIDER",
            primaryOrganSystem: "ophthalmology",
            suggestedSpecialty: "Ophthalmology",
            evidenceBasis: "Blurry vision requiring slit-lamp and visual acuity assessment.",
          },
        ],
        recommendedSpecialty: "Ophthalmology",
        urgency: "ROUTINE_APPOINTMENT",
        reasoningBasis: "Ocular pain, redness, or visual changes are evaluated by Ophthalmology.",
      };
    }

    // Case 5: Neurological Presentation (Headache / Migraine / Numbness)
    if (hasHeadache || hasNeuro) {
      return {
        possibilities: [
          {
            conditionName: "Migraine / tension-type headache syndrome",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "neurological",
            suggestedSpecialty: isSevere || hasNeuro ? "Neurology" : "General Medicine",
            evidenceBasis: "Cranial pain, throbbing quality, or neurological sensory symptoms.",
          },
          {
            conditionName: "Peripheral neuropathy / radiculopathy",
            likelihood: "CONSIDER",
            primaryOrganSystem: "neurological",
            suggestedSpecialty: "Neurology",
            evidenceBasis: "Limb tingling or numbness requiring neurological assessment.",
          },
        ],
        recommendedSpecialty: isSevere || hasNeuro ? "Neurology" : "General Medicine",
        urgency: isSevere ? "SAME_DAY_EVALUATION" : "ROUTINE_APPOINTMENT",
        reasoningBasis: "Cranial pain, migraines, and neurological presentations are assessed by Neurology or Primary Care.",
      };
    }

    // Case 6: Cardiovascular (Non-Emergency)
    if (hasChest) {
      return {
        possibilities: [
          {
            conditionName: "Musculoskeletal chest wall tenderness",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "cardiovascular",
            suggestedSpecialty: "Cardiology",
            evidenceBasis: "Chest discomfort requiring cardiovascular baseline clearance.",
          },
        ],
        recommendedSpecialty: "Cardiology",
        urgency: "SAME_DAY_EVALUATION",
        reasoningBasis: "Any non-emergency chest complaint requires prompt cardiovascular evaluation.",
      };
    }

    // Case 7: Dermatology
    if (hasSkin) {
      return {
        possibilities: [
          {
            conditionName: "Contact dermatitis / atopic eczema",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "dermatology",
            suggestedSpecialty: "Dermatology",
            evidenceBasis: "Cutaneous eruption, rash, or pruritus.",
          },
        ],
        recommendedSpecialty: "Dermatology",
        urgency: "ROUTINE_APPOINTMENT",
        reasoningBasis: "Cutaneous eruptions and skin lesions are evaluated by Dermatology.",
      };
    }

    // Case 8: Musculoskeletal
    if (hasJoint) {
      return {
        possibilities: [
          {
            conditionName: "Joint sprain / musculoskeletal strain",
            likelihood: "POSSIBLE",
            primaryOrganSystem: "musculoskeletal",
            suggestedSpecialty: "Orthopedics",
            evidenceBasis: "Localized bone, joint, or spinal discomfort.",
          },
        ],
        recommendedSpecialty: "Orthopedics",
        urgency: "ROUTINE_APPOINTMENT",
        reasoningBasis: "Bone, joint, and musculoskeletal mechanical symptoms fall under Orthopedics.",
      };
    }

    // Default / Constitutional
    return {
      possibilities: [
        {
          conditionName: "General constitutional symptoms",
          likelihood: "POSSIBLE",
          primaryOrganSystem: "general",
          suggestedSpecialty: "General Medicine",
          evidenceBasis: "Constitutional health concerns requiring baseline physical evaluation.",
        },
      ],
      recommendedSpecialty: "General Medicine",
      urgency: "ROUTINE_APPOINTMENT",
      reasoningBasis: "Primary Care (General Medicine) provides comprehensive initial evaluation and specialty referral.",
    };
  }
}
