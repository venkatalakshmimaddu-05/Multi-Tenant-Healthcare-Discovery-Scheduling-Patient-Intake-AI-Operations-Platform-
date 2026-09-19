# AuraCare AI — AI Tools & Usage Documentation
**Agentic Tool Schemas, Multi-Modal Voice Orchestration & Clinical Ontologies**

---

## 1. AI Models & Voice Technologies

- **Reasoning & Tool Calling:** OpenAI GPT-4o / Realtime API for intent classification and function calling.
- **Voice Telephony:** Twilio Voice & TwiML integration answering PSTN phone calls.
- **Neural Text-to-Speech:** Amazon Polly Neural (`Polly.Joanna-Neural`) for lifelike voice synthesis.
- **In-Browser Audio:** Web Speech Recognition API & Web Audio Context for zero-cost microphone interactions.

---

## 2. Agentic Tool Calling (CapabilityManager)

1. `check_availability`: Discovers real-time doctor slots by specialty, doctor name, hospital, and timeframe.
2. `create_appointment`: Atomically books an appointment slot, acquires a concurrency lock, and synchronizes with the EHR.
3. `reschedule_appointment`: Atomically shifts an existing appointment to a new slot while freeing the previous opening.
4. `cancel_appointment`: Cancels an appointment and releases the doctor slot in internal and external EHR calendars.
5. `get_questionnaire`: Retrieves the specialty-specific clinical intake form assigned to the patient.

---

## 3. Clinical Knowledge Base & Safety Ontologies

- **50+ Standardized Concepts:** Standardized terms across 9 organ systems with natural-language synonyms and colloquial expressions.
- **4-Way Presence Polarity:** Distinguishes `PRESENT`, `NEGATED` (explicit denials), `UNCERTAIN`, and `UNKNOWN`.
- **Deterministic Red-Flag Layer:** Hard-coded safety screening for ACS, Stroke, Thunderclap, Acute Abdomen, and Airway compromise that cannot be overridden by conversational prompts.

---

## 4. Verification & Testing

- **Vitest 2.0:** 59 automated test cases covering scheduling concurrency, clinical safety, EHR failure recovery, and multi-turn voice flows.
- **Production Build:** 18/18 static and dynamic Next.js routes compile with zero warnings or errors.
