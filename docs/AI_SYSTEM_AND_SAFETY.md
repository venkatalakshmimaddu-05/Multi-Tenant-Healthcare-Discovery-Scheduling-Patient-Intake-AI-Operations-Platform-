# AI Patient Access Agent & Clinical Safety Boundaries

## 1. Role & System Mandate (PRD Section 20)

The AI Patient Access Agent is an **administrative healthcare assistant**, not a diagnostic clinician.
The system is explicitly engineered to adhere to strict clinical safety boundaries:

### What the AI May Do:
- Discover accredited hospitals and clinical departments.
- Discover licensed physicians by symptom keywords or specialty.
- Query real calendar availability without inventing phantom slots.
- Coordinate atomic appointment bookings, reschedules, and cancellations.
- Collect patient responses for administrator-approved pre-visit questionnaires.
- Dispatch confirmation notifications and remind patients of intake forms.
- Escalate unrecoverable errors or medical emergencies to human personnel.

### What the AI Must NEVER Do:
- Diagnose diseases or clinical conditions.
- Prescribe medications or suggest drug dosages.
- Recommend medical treatments or alter treatment regimens.
- Make independent clinical assessments.
- Invent clinical information or hallucinate medical guidance.

### Linguistic Boundary Enforcement:
The AI is programmed to distinguish between patient-reported symptoms and unsupported diagnostic claims:
- Allowed: *"You reported shoulder discomfort."*
- Prohibited: *"You have a rotator cuff tear."*

When a patient asks diagnostic questions (e.g. *"Can you diagnose what disease is causing my knee pain?"* or *"What medicine should I take?"*), the AI immediately triggers an **Administrative Boundary Refusal**:
> *"I am an administrative scheduling assistant and cannot provide medical diagnoses, prescribe medications, or assess medical conditions. If you are experiencing a severe or life-threatening emergency, please call 911 immediately. Otherwise, I can gladly help you book an appointment with one of our certified doctors."*

---

## 2. Conversational Context & Multi-Turn State Resolution (PRD Section 10)

The conversation engine retains multi-turn context across turns:
- Current intent (`currentIntent`)
- Matched specialty (`specialtyKeyword`)
- Selected doctor (`selectedDoctorId`)
- Target date / timeframe (`timeframe`)

### Example Multi-Turn Flow:
```
Turn 1:
Patient: "I need to see Dr. Rao for my shoulder pain."
AI: "I found Dr. Ananya Rao for Orthopedics at Metro Health Medical Center. Would Friday work?"

Turn 2:
Patient: "Actually, make that Friday at 10 AM."
AI resolves:
- "that" = appointment with Dr. Ananya Rao
- "Friday at 10 AM" = target slot
AI checks real availability -> executes booking -> verifies EHR -> confirms to patient.
```

---

## 3. Real-Time Voice & Telephone Engineering (PRD Section 11)

The platform supports two distinct voice modalities:
1. **Interactive Web Voice Assistant**:
   - Built on the Web Speech API (`SpeechRecognition` & `SpeechSynthesis`).
   - Integrated visual equalizer wave reacting to user speech and AI responses.
   - Perceived latency monitoring badge displaying turn elapsed time (targeting sub-2000ms latency).
   - Instant **Barge-In**: User speech or microphone activation immediately cancels active speech synthesis output.

2. **Telephone Call Simulator**:
   - Realistic inbound call interface displaying Inbound Line (`1-800-METRO-CARE`), caller ID (`+1-555-0199 - Alex Morgan`), simulated audio connection tones, live call timer, and interactive telephone dial pad.