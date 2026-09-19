# Booking Sequence & Lifecycle Flow

## Sequence Diagram

The following diagram illustrates the complete, connected lifecycle from the patient's spoken request to external EHR verification and pre-visit intake assignment:

```mermaid
sequenceDiagram
    autonumber
    actor Patient
    participant VoiceUI as Voice / Phone UI
    participant Agent as AI Agent Engine
    participant Cap as Capability Manager
    participant Sched as Scheduling Service
    participant EHR as External EHR Connector
    participant DB as Internal Database
    participant WF as Workflow Engine
    actor Doctor

    Patient->>VoiceUI: "I need to see a doctor for my shoulder pain this week."
    VoiceUI->>Agent: Audio stream / transcript turn
    Agent->>Cap: search_doctors(specialty="Orthopedics")
    Cap->>DB: Query active doctors in approved hospitals
    DB-->>Cap: Return [Dr. Ananya Rao, Orthopedics, Metro Health]
    Cap-->>Agent: Doctor match found
    Agent->>VoiceUI: "I found Dr. Ananya Rao for Orthopedics. Would Friday work?"
    Patient->>VoiceUI: "Actually, make that Friday at 10 AM."
    VoiceUI->>Agent: Resolve "that" using active conversation context
    Agent->>Cap: check_availability(doctorId, date="Friday")
    Cap->>Sched: getAvailableSlots(doctorId, date)
    Sched-->>Cap: Return available slots [09:30, 10:00, 10:30...]
    Cap-->>Agent: Slots verified
    Agent->>Cap: create_appointment(doctorId, patientId, slot="10:00 AM")
    
    rect rgb(240, 248, 255)
        note right of Cap: Atomic Booking & EHR Verification Loop
        Cap->>Sched: acquireLock(doctorId, startTime) [Double-Booking Mutex]
        Sched-->>Cap: Lock acquired
        Cap->>Sched: isSlotStillAvailable(doctorId, startTime)
        Sched-->>Cap: Revalidation confirmed
        Cap->>DB: Insert Appointment (status: SYNCHRONIZATION_PENDING)
        Cap->>EHR: createAppointment(payload, idempotencyKey, correlationId)
        EHR-->>Cap: Response (status: CONFIRMED, extId: "EHR-APT-...")
        Cap->>EHR: verifyAppointment(externalAppointmentId)
        EHR-->>Cap: External Record Verified: TRUE
        Cap->>DB: Update Appointment (status: CONFIRMED, ehrVerificationStatus: VERIFIED)
        Cap->>Sched: releaseLock(doctorId, startTime)
    end

    Cap->>WF: trigger(APPOINTMENT_BOOKED)
    WF->>DB: Auto-assign Pre-Visit Questionnaire (Orthopedic Intake)
    WF->>VoiceUI: Dispatch SMS Confirmation Notification
    Cap-->>Agent: Booking & EHR Verification Complete
    Agent->>VoiceUI: "Your appointment with Dr. Rao is confirmed. Please complete your intake questionnaire!"
    VoiceUI->>Patient: Speech synthesis turn
    
    rect rgb(245, 255, 245)
        note right of Patient: Pre-Visit Clinical Intake
        Patient->>VoiceUI: Completes intake questionnaire
        VoiceUI->>Cap: submit_questionnaire(responses)
        Cap->>DB: Store QuestionnaireResponse
        Doctor->>DB: Doctor Dashboard reviews structured intake prior to visit
    end
```