import { prisma } from "../prisma";
import { ConversationalState, NluParseResult } from "../types";
import { CapabilityManager } from "./capabilityManager";
import { AuditService } from "./auditService";
import { ClinicalTriageEngine } from "./clinicalTriageEngine";

export interface AgentTurnResponse {
  replyText: string;
  actionTaken?: string;
  capabilityCalled?: string;
  capabilityPayload?: any;
  capabilityResult?: any;
  clarificationRequired?: boolean;
  isClinicalRefusal?: boolean;
  correlationId: string;
  latencyMs: number;
}

export class AiAgentEngine {
  /**
   * Helper for multi-turn dialogue tests or simplified voice turn processing.
   */
  public static async processDialogueTurn(
    patientId: string,
    userMessage: string,
    correlationId?: string
  ): Promise<AgentTurnResponse> {
    const convId = correlationId || AuditService.generateCorrelationId("ai-conv");
    return this.processTurn(convId, userMessage, patientId, correlationId);
  }

  /**
   * Processes a turn in the voice or chat conversation.
   */
  public static async processTurn(
    conversationId: string,
    userMessage: string,
    patientId: string,
    correlationId?: string
  ): Promise<AgentTurnResponse> {
    const startTimeMs = Date.now();
    const corrId = correlationId || AuditService.generateCorrelationId("ai-conv");

    // 1. Retrieve or initialize conversation & context
    let conversation = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
      include: { context: true },
    });

    if (!conversation) {
      conversation = await prisma.aiConversation.create({
        data: {
          id: conversationId,
          patientId,
          correlationId: corrId,
          transcriptJson: JSON.stringify([]),
        },
        include: { context: true },
      });
    }

    let aiContext = conversation.context;
    if (!aiContext) {
      aiContext = await prisma.aiContext.create({
        data: {
          conversationId,
          extractedEntities: JSON.stringify({}),
        },
      });
    }

    const entities = aiContext.extractedEntities ? JSON.parse(aiContext.extractedEntities) : {};

    // 2. Perform Natural Language Understanding & Clinical Safety Boundary Check (PRD Section 20)
    const nlu = this.parseUserInput(userMessage, entities);

    // CLINICAL REFUSAL GUARDRAIL
    if (nlu.isClinicalViolation) {
      const refusalReply =
        "I am an administrative scheduling assistant and cannot provide medical diagnoses, prescribe medications, or assess medical conditions. If you are experiencing a severe or life-threatening emergency, please call 911 immediately. Otherwise, I can gladly help you book an appointment with one of our certified doctors.";

      await this.saveTranscript(conversation.id, userMessage, refusalReply);
      return {
        replyText: refusalReply,
        isClinicalRefusal: true,
        correlationId: corrId,
        latencyMs: Date.now() - startTimeMs,
      };
    }

    // 2b. Clinical Triage Pipeline & Safety Screening
    const isNewEncounter = Boolean(entities.appointmentConfirmed || entities.lastConfirmedAppointmentId);
    const priorState = isNewEncounter ? undefined : entities.triageState;
    const triageState = ClinicalTriageEngine.extractAndAccumulate(
      userMessage,
      priorState
    );
    entities.triageState = triageState;

    // Check Red Flags
    const redFlags = ClinicalTriageEngine.evaluateRedFlags(triageState, userMessage);
    if (redFlags.length > 0) {
      const emergencyAssessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(triageState, redFlags);
      await this.saveTranscript(conversation.id, userMessage, emergencyAssessment.voice_reply);
      return {
        replyText: emergencyAssessment.voice_reply,
        isClinicalRefusal: true,
        correlationId: corrId,
        latencyMs: Date.now() - startTimeMs,
      };
    }

    // Detect Missing Information and compute differential
    ClinicalTriageEngine.detectMissingInformation(triageState);
    const clinicalAssessment = ClinicalTriageEngine.computeDifferentialAndSpecialty(
      triageState,
      redFlags,
      userMessage
    );

    // If critical information is missing on the first turn with new symptoms and user didn't ask for a specific doctor or slot:
    const isExplicitBookingDemand =
      Boolean(nlu.doctorName) ||
      Boolean(entities.doctorName) ||
      Boolean(nlu.timeframe && nlu.timeframe !== "next_available" && nlu.timeframe !== "friday") ||
      /(?:\bat\s+)?\d{1,2}(?::|\s+)?\d{0,2}\s*(?:am|pm)?/i.test(userMessage) ||
      nlu.intent === "RESCHEDULE";

    if (
      clinicalAssessment.needsFollowUp &&
      !entities.triage_completed &&
      !isExplicitBookingDemand &&
      !entities.lastConfirmedAppointmentId &&
      nlu.intent !== "UNSUPPORTED_SPECIALTY" &&
      nlu.intent !== "QUESTIONNAIRE_INFO" &&
      nlu.intent !== "APPOINTMENT_STATUS" &&
      nlu.intent !== "PORTAL_NAVIGATION" &&
      nlu.intent !== "GRATITUDE"
    ) {
      entities.triageState = triageState;
      await prisma.aiContext.update({
        where: { id: aiContext.id },
        data: {
          extractedEntities: JSON.stringify(entities),
          currentIntent: "CLINICAL_FOLLOW_UP",
        },
      });

      await this.saveTranscript(conversation.id, userMessage, clinicalAssessment.voice_reply);
      return {
        replyText: clinicalAssessment.voice_reply,
        correlationId: corrId,
        latencyMs: Date.now() - startTimeMs,
      };
    }

    if (triageState.symptoms.length > 0 && clinicalAssessment.recommended_specialty) {
      entities.triage_completed = true;
      if (
        !nlu.specialtyKeyword ||
        (nlu.specialtyKeyword === "General Medicine" &&
          clinicalAssessment.recommended_specialty !== "General Medicine" &&
          triageState.severity === "severe")
      ) {
        nlu.specialtyKeyword = clinicalAssessment.recommended_specialty;
      }
      entities.specialtyKeyword = nlu.specialtyKeyword;
      entities.differential_considerations = clinicalAssessment.possible_causes;
      if (nlu.intent === "CLARIFICATION_NEEDED") {
        nlu.intent = "BOOK_APPOINTMENT";
      }
    }

    // 3. Update Conversation Context (PRD Section 10: "Actually, make that Friday")
    // Context Switch Detection:
    // If the patient specifies a new symptom or specialty keyword that differs from the existing doctor's specialty,
    // or mentions a different doctor, we MUST invalidate the previous doctor selection to avoid recommending the wrong specialist.
    if (nlu.specialtyKeyword) {
      if (aiContext.selectedDoctorId) {
        const curDoc = await prisma.doctor.findUnique({
          where: { id: aiContext.selectedDoctorId },
          include: { specialty: true },
        });
        if (curDoc && curDoc.specialty.name.toLowerCase() !== nlu.specialtyKeyword.toLowerCase()) {
          // Patient switched symptoms/specialty (e.g., from Ortho to Dermatology)!
          aiContext.selectedDoctorId = null;
          aiContext.selectedHospitalId = null;
          delete entities.doctorName;
          entities.triageState = ClinicalTriageEngine.extractAndAccumulate(userMessage);
        }
      }
      if (entities.lastBookedDoctorId) {
        const prevDoc = await prisma.doctor.findUnique({
          where: { id: entities.lastBookedDoctorId },
          include: { specialty: true },
        });
        if (prevDoc && prevDoc.specialty.name.toLowerCase() !== nlu.specialtyKeyword.toLowerCase()) {
          delete entities.lastBookedDoctorId;
          delete entities.lastBookedDoctorName;
          delete entities.lastBookedSpecialty;
          delete entities.lastBookedHospitalId;
          delete entities.lastBookedHospitalName;
          delete entities.lastBookedSlot;
          delete entities.lastConfirmedAppointmentId;
          delete entities.appointmentConfirmed;
        }
      }
      entities.specialtyKeyword = nlu.specialtyKeyword;
      entities.specialty = nlu.specialtyKeyword;
    }

    if (nlu.doctorName) {
      if (aiContext.selectedDoctorId) {
        const curDoc = await prisma.doctor.findUnique({
          where: { id: aiContext.selectedDoctorId },
        });
        if (curDoc && !curDoc.name.toLowerCase().includes(nlu.doctorName.toLowerCase())) {
          // Patient asked for a different doctor! Clear out old doctor selection
          aiContext.selectedDoctorId = null;
          aiContext.selectedHospitalId = null;
        }
      }
      entities.doctorName = nlu.doctorName;
    }

    if (nlu.timeframe) {
      if (nlu.timeframe === "next_available") {
        delete entities.timeframe;
        entities.wantsAlternativeDay = true;
      } else {
        entities.timeframe = nlu.timeframe;
      }
    }

    if (nlu.rejectedDay) {
      if (!entities.rejectedDays) entities.rejectedDays = [];
      if (!entities.rejectedDays.includes(nlu.rejectedDay)) {
        entities.rejectedDays.push(nlu.rejectedDay);
      }
      if (entities.timeframe === nlu.rejectedDay) {
        delete entities.timeframe;
      }
    }

    await prisma.aiContext.update({
      where: { id: aiContext.id },
      data: {
        selectedDoctorId: aiContext.selectedDoctorId,
        selectedHospitalId: aiContext.selectedHospitalId,
        currentIntent: nlu.intent,
        extractedEntities: JSON.stringify(entities),
      },
    });

    let replyText = "";
    let actionTaken = undefined;
    let capabilityCalled = undefined;
    let capabilityResultData = undefined;

    // 4. Intent Execution via Controlled Capabilities
    switch (nlu.intent) {
      case "UNSUPPORTED_SPECIALTY": {
        if (nlu.unsupportedSpecialty === "DENTAL") {
          replyText =
            "Our hospital network currently does not have an on-site Dental clinic registered. However, our General Medicine physician, Dr. David Kim at City Care General Hospital, can provide initial clinical assessment or temporary pain relief while you consult a dentist. Would you like me to check openings with Dr. Kim?";
        } else if (nlu.unsupportedSpecialty === "PSYCHIATRY") {
          replyText =
            "We do not currently have a dedicated Psychiatry or Behavioral Health clinic registered at our facilities. If you or someone you know is in crisis or experiencing thoughts of self-harm, please dial or text 988 to reach the Suicide & Crisis Lifeline immediately. For non-emergencies, our primary care physician, Dr. David Kim, can assist with an initial medical evaluation and specialist referral. Would you like to check openings with Dr. Kim?";
        } else if (nlu.unsupportedSpecialty === "UROLOGY") {
          replyText =
            "We do not currently have a standalone Urology or Nephrology clinic registered. However, our General Medicine physician, Dr. David Kim, handles primary kidney and urinary evaluations and can issue direct lab orders or specialist referrals. Would you like me to check Dr. Kim's availability?";
        } else if (nlu.unsupportedSpecialty === "OBGYN") {
          replyText =
            "We currently do not have an active Obstetrics & Gynecology department registered in our network. Our General Medicine physician, Dr. David Kim, can assist with initial consultations and refer you to an accredited women's health partner. Would you like to check Dr. Kim's openings?";
        } else if (nlu.unsupportedSpecialty === "ONCOLOGY") {
          replyText =
            "While we do not have an on-site Oncology center registered, our General Medicine physician, Dr. David Kim, provides comprehensive initial assessments and direct cancer center referral coordination. Would you like to check openings with Dr. Kim?";
        } else {
          replyText =
            "That specialty is not currently available at our accredited medical centers. Would you like me to check openings with our General Medicine physician, Dr. David Kim, for an initial consultation and referral?";
        }
        break;
      }

      case "CLARIFICATION_NEEDED": {
        replyText =
          "Could you please tell me what symptoms or health concerns you are experiencing today, or do you have a specific doctor in mind?";
        break;
      }

      case "INQUIRE_SPECIALTY":
      case "CHECK_AVAILABILITY":
      case "BOOK_APPOINTMENT":
      case "RESCHEDULE": {
        // Guardrail: If no doctor and no specialty/symptom is known, clarify rather than guessing (PRD Principle 2)
        if (
          !aiContext.selectedDoctorId &&
          !entities.lastBookedDoctorId &&
          !entities.specialtyKeyword &&
          !nlu.specialtyKeyword &&
          !entities.doctorName &&
          !nlu.doctorName
        ) {
          replyText = "Could you please describe what medical symptoms you are having, or which specialty you are looking for?";
          break;
        }

        // Step A: If doctor or specialty unknown, discover via search_doctors
        let targetDoctorId: string | undefined = aiContext.selectedDoctorId || undefined;
        if (!targetDoctorId && entities.lastBookedDoctorId && (nlu.intent === "RESCHEDULE" || !nlu.specialtyKeyword)) {
          targetDoctorId = entities.lastBookedDoctorId;
        }

        if (!targetDoctorId) {
          const docSearchResult = await CapabilityManager.execute(
            "search_doctors",
            {
              specialty: entities.specialtyKeyword || nlu.specialtyKeyword || undefined,
              name: entities.doctorName || nlu.doctorName || undefined,
            },
            corrId,
            conversationId
          );

          capabilityCalled = "search_doctors";
          capabilityResultData = docSearchResult.data;

          const doctors = (docSearchResult.data as any[]) || [];
          if (doctors.length === 0) {
            replyText = `I couldn't find any active specialists matching "${nlu.specialtyKeyword || userMessage}". Would you like me to check our General Medicine or Orthopedic department?`;
            break;
          }

          // Select first matching doctor and save to context
          const doctor = doctors[0];
          targetDoctorId = doctor.id;
          entities.doctorName = doctor.name;
          entities.specialty = doctor.specialty?.name;

          await prisma.aiContext.update({
            where: { id: aiContext.id },
            data: {
              selectedDoctorId: targetDoctorId,
              selectedHospitalId: doctor.hospitalId,
              extractedEntities: JSON.stringify(entities),
            },
          });
        }

        // Fetch Doctor details
        const docRecord = await prisma.doctor.findUnique({
          where: { id: targetDoctorId },
          include: { specialty: true, hospital: true },
        });

        if (!docRecord) {
          replyText = "I had trouble loading that doctor's details. Could you please specify who you'd like to see?";
          break;
        }

        // Step B: Check Real Availability (PRD: AI must never invent availability)
        // Determine target date from entities or user query
        let targetDate = this.resolveTargetDate(entities.timeframe || nlu.timeframe);

        const isDayRejected = (d: Date) => {
          const dayName = d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
          return (
            (nlu.rejectedDay && nlu.rejectedDay.toLowerCase() === dayName) ||
            (entities.rejectedDays && entities.rejectedDays.includes(dayName))
          );
        };

        let availableSlots: any[] = [];

        // If targetDate falls on a rejected day, advance to the next available non-rejected weekday
        if (isDayRejected(targetDate)) {
          for (let step = 1; step <= 14; step++) {
            const nextCandidate = new Date(targetDate);
            nextCandidate.setDate(nextCandidate.getDate() + step);
            if (nextCandidate.getDay() === 0 || nextCandidate.getDay() === 6) continue; // skip weekends
            if (isDayRejected(nextCandidate)) continue; // skip rejected days

            const nextAvail = await CapabilityManager.execute(
              "check_availability",
              { doctorId: targetDoctorId, date: nextCandidate.toISOString() },
              corrId,
              conversationId
            );
            const nextSlots = (nextAvail.data as any[]) || [];
            if (nextSlots.length > 0) {
              targetDate = nextCandidate;
              availableSlots = nextSlots;
              capabilityCalled = "check_availability";
              capabilityResultData = nextSlots;
              delete entities.wantsAlternativeDay;
              break;
            }
          }
        }

        if (availableSlots.length === 0) {
          let availResult = await CapabilityManager.execute(
            "check_availability",
            { doctorId: targetDoctorId, date: targetDate.toISOString() },
            corrId,
            conversationId
          );

          capabilityCalled = "check_availability";
          capabilityResultData = availResult.data;
          availableSlots = (availResult.data as any[]) || [];

          // If no slots on chosen date (e.g. weekend or fully booked), look ahead up to 5 weekdays
          if (availableSlots.length === 0) {
            for (let i = 1; i <= 5; i++) {
              const nextDay = new Date(targetDate);
              nextDay.setDate(nextDay.getDate() + i);
              if (nextDay.getDay() === 0 || nextDay.getDay() === 6) continue; // skip weekends
              if (isDayRejected(nextDay)) continue;
              const nextAvail = await CapabilityManager.execute(
                "check_availability",
                { doctorId: targetDoctorId, date: nextDay.toISOString() },
                corrId,
                conversationId
              );
              const nextSlots = (nextAvail.data as any[]) || [];
              if (nextSlots.length > 0) {
                targetDate = nextDay;
                availableSlots = nextSlots;
                capabilityResultData = nextAvail.data;
                break;
              }
            }
          }
        }

        if (availableSlots.length === 0) {
          replyText = `${docRecord.name} at ${docRecord.hospital.name} has no remaining openings for this week. Would you like me to check next week?`;
          break;
        }

        // Intelligent slot extraction & booking confirmation
        const lowerMsg = userMessage.toLowerCase().trim();

        // 1. Rejection & negative constraint detection
        const isRejection =
          Boolean(nlu.rejectedDay) ||
          Boolean(nlu.isRejectingSlotOrDay) ||
          Boolean(nlu.wantsAlternativeDay) ||
          /\b(?:cannot|can't|cant|couldn't|could not|do not have|don't have|no time|have plans|plans on|busy|not free|not available|unavailable|won't work|doesn't work|does not work|not on|another day|different day|other day|some other day|any other day|next week|change day|different time|not that|not this)\b/i.test(lowerMsg);

        // Check if user specifically negated a time (e.g. "cannot do 9:30", "9:30 does not work", "not 9:30")
        const isNegatedTime =
          /(?:cannot|can't|cant|couldn't|not|won't|doesn't\s+work\s+at)\s+(?:do\s+|make\s+|at\s+)?\d{1,2}(?::|\s+)?\d{0,2}/i.test(lowerMsg) ||
          /\d{1,2}(?::|\s+)?\d{0,2}\s*(?:am|pm)?\s+(?:doesn't|does not|won't|will not|is not)\s+work/i.test(lowerMsg);

        let chosenSlot: any = null;

        // 2. Time matching using robust extractRequestedTime
        // Only consider time match if user did not negate the time and is not rejecting without a new timeframe
        if (!isNegatedTime && (!isRejection || (Boolean(nlu.timeframe) && nlu.timeframe !== "next_available"))) {
          const parsedReqTime = AiAgentEngine.extractRequestedTime(lowerMsg);
          if (parsedReqTime) {
            // First pass: exact match on hour and minute (and AM/PM period if specified)
            chosenSlot = availableSlots.find((slot: any) => {
              const timeStr = slot.formattedTime || ""; // e.g. "9:30 AM"
              const slotMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
              if (slotMatch) {
                const sHour = parseInt(slotMatch[1], 10);
                const sMin = parseInt(slotMatch[2], 10);
                const sPeriod = slotMatch[3].toUpperCase();

                if (parsedReqTime.period && parsedReqTime.period !== sPeriod) return false;
                return sHour === parsedReqTime.hour && sMin === parsedReqTime.minute;
              }
              return false;
            });

            // Second pass: if minute was 0 (e.g. "10 o'clock" or "at 10"), allow matching slot by hour
            if (!chosenSlot && parsedReqTime.minute === 0) {
              chosenSlot = availableSlots.find((slot: any) => {
                const timeStr = slot.formattedTime || "";
                const slotMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                if (slotMatch) {
                  const sHour = parseInt(slotMatch[1], 10);
                  const sPeriod = slotMatch[3].toUpperCase();

                  if (parsedReqTime.period && parsedReqTime.period !== sPeriod) return false;
                  return sHour === parsedReqTime.hour;
                }
                return false;
              });
            }
          }
        }

        // Relative slot position matching: "first", "second", "third", "last" (ONLY when not rejecting)
        if (!chosenSlot && !isRejection) {
          if (lowerMsg.includes("first") || lowerMsg.includes("earliest")) {
            chosenSlot = availableSlots[0];
          } else if (lowerMsg.includes("second") && availableSlots.length > 1) {
            chosenSlot = availableSlots[1];
          } else if (lowerMsg.includes("third") && availableSlots.length > 2) {
            chosenSlot = availableSlots[2];
          }
        }

        // Positive confirmation regex patterns using strict word boundaries
        const positiveConfirmationPatterns = [
          /\b(?:book(?:\s+it|\s+that)?|confirm(?:\s+it)?|yes|yep|sure|okay|ok)\b/i,
          /\b(?:that works|sounds good|go ahead|let's do that|let us do that|take that|that one|mind that|find that|fine that)\b/i,
          /\b(?:perfect|great)\b/i,
          /\bi want\s+(?:that|this|the\s+(?:first|second|third|earliest|latest)|to book|\d{1,2}(?::|\s+)?\d{0,2})/i,
          /\bi can do\s+(?:that|this|\d{1,2}(?::|\s+)?\d{0,2})/i,
        ];

        const hasPositiveConfirmation =
          !isRejection &&
          positiveConfirmationPatterns.some((pattern) => pattern.test(lowerMsg));

        const isRescheduling =
          nlu.intent === "RESCHEDULE" ||
          Boolean(entities.lastConfirmedAppointmentId) ||
          Boolean(entities.appointmentConfirmed);

        const isConfirming = !isRejection && (Boolean(chosenSlot) || hasPositiveConfirmation);

        // If user confirmed without specifying a slot, default to first available slot ONLY when not rejecting
        if (isConfirming && !chosenSlot && availableSlots.length > 0 && !isRejection) {
          chosenSlot = availableSlots[0];
        }

        if (isConfirming && chosenSlot) {
          // Execute create_appointment with full EHR integration & verification loop
          const bookResult = await CapabilityManager.execute(
            "create_appointment",
            {
              doctorId: targetDoctorId,
              patientId,
              hospitalId: docRecord.hospitalId,
              startTime: chosenSlot.startTime,
              endTime: chosenSlot.endTime,
              type: "IN_PERSON",
            },
            corrId,
            conversationId
          );

          capabilityCalled = "create_appointment";
          capabilityResultData = bookResult;

          if (bookResult.success) {
            let previousApptId = entities.lastConfirmedAppointmentId || nlu.appointmentId;
            if (!previousApptId && isRescheduling) {
              const existingAppt = await prisma.appointment.findFirst({
                where: { patientId, status: "CONFIRMED" },
                orderBy: { createdAt: "desc" },
              });
              if (existingAppt) {
                previousApptId = existingAppt.id;
              }
            }

            if (isRescheduling && previousApptId && previousApptId !== bookResult.data?.id) {
              await CapabilityManager.execute(
                "cancel_appointment",
                {
                  appointmentId: previousApptId,
                  reason: "Patient rescheduled to new date/time via AI Voice Agent",
                },
                corrId,
                conversationId
              );
              actionTaken = "APPOINTMENT_RESCHEDULED";
              replyText = `Your appointment with ${docRecord.name} at ${docRecord.hospital.name} has been rescheduled to ${chosenSlot.formattedDate} at ${chosenSlot.formattedTime}. We've updated your record with the external hospital system. Please complete the pre-visit intake questionnaire sent to your account!`;
            } else {
              actionTaken = "APPOINTMENT_CONFIRMED";
              replyText = `Your appointment with ${docRecord.name} at ${docRecord.hospital.name} is confirmed for ${chosenSlot.formattedDate} at ${chosenSlot.formattedTime}. We've verified your record with the external hospital system. Please complete the pre-visit intake questionnaire sent to your account!`;
            }

            // Prevent doctor booking loop for subsequent conversational turns while retaining doctor/clinic info
            entities.appointmentConfirmed = true;
            entities.lastConfirmedAppointmentId = bookResult.data?.id;
            entities.lastBookedDoctorId = docRecord.id;
            entities.lastBookedDoctorName = docRecord.name;
            entities.lastBookedSpecialty = docRecord.specialty?.name;
            entities.lastBookedHospitalId = docRecord.hospitalId;
            entities.lastBookedHospitalName = docRecord.hospital.name;
            entities.lastBookedSlot = `${chosenSlot.formattedDate} at ${chosenSlot.formattedTime}`;
            delete entities.doctorName;
            delete entities.specialtyKeyword;
            delete entities.timeframe;
            delete entities.rejectedDays;

            await prisma.aiContext.update({
              where: { id: aiContext.id },
              data: {
                selectedDoctorId: null,
                selectedHospitalId: null,
                currentIntent: "APPOINTMENT_CONFIRMED",
                extractedEntities: JSON.stringify(entities),
              },
            });
          } else {
            replyText = `We encountered a delay with the hospital system: ${bookResult.error}. Our clinic coordinator has been notified for human review.`;
          }
        } else {
          // Present options clearly for voice turn-taking
          const slotOptions = availableSlots.slice(0, 3).map((s) => `${s.formattedTime}`).join(", ");
          const dayFormatted = targetDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

          const differentialPrefix =
            entities.differential_considerations && !entities.differential_articulated
              ? `Based on your symptoms, possible considerations include ${entities.differential_considerations.slice(0, 2).join(" or ")}. I recommend an evaluation with our ${docRecord.specialty.name} specialist. `
              : "";
          if (differentialPrefix) {
            entities.differential_articulated = true;
          }

          if (isRescheduling) {
            replyText = `${differentialPrefix}I found openings to reschedule with ${docRecord.name} (${docRecord.specialty.name} at ${docRecord.hospital.name}) on ${dayFormatted} at ${slotOptions}. Which time works best for you?`;
          } else if (nlu.rejectedDay || isRejection) {
            const rejectedDayDisplay = nlu.rejectedDay ? (nlu.rejectedDay.charAt(0).toUpperCase() + nlu.rejectedDay.slice(1)) : "that day";
            replyText = `${differentialPrefix}Understood, let's look at another day instead of ${rejectedDayDisplay}. I found openings with ${docRecord.name} (${docRecord.specialty.name} at ${docRecord.hospital.name}) on ${dayFormatted} at ${slotOptions}. Which time works best for you?`;
          } else {
            replyText = `${differentialPrefix}I found openings with ${docRecord.name} (${docRecord.specialty.name} at ${docRecord.hospital.name}) on ${dayFormatted} at ${slotOptions}. Which time works best for you?`;
          }

          // Persist the active target day into entities so subsequent slot selections ("at 9 30") resolve to this day!
          entities.timeframe = targetDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
          await prisma.aiContext.update({
            where: { id: aiContext.id },
            data: {
              extractedEntities: JSON.stringify(entities),
            },
          });
        }
        break;
      }

      case "QUESTIONNAIRE_INFO": {
        const latestAppt = await prisma.appointment.findFirst({
          where: { patientId, status: "CONFIRMED" },
          orderBy: { createdAt: "desc" },
          include: {
            doctor: { include: { specialty: true } },
            hospital: true,
            questionnaireResponses: true,
          },
        });

        if (latestAppt && latestAppt.questionnaireResponses.length > 0) {
          replyText = `You have already completed and submitted your pre-visit intake questionnaire for your appointment with ${latestAppt.doctor.name}. Our clinical team has your answers on file!`;
          break;
        }

        const questResult = await CapabilityManager.execute(
          "get_questionnaire",
          {
            appointmentId: latestAppt?.id,
            hospitalId: latestAppt?.hospitalId,
            specialtyId: latestAppt?.doctor?.specialtyId,
          },
          corrId,
          conversationId
        );

        capabilityCalled = "get_questionnaire";
        capabilityResultData = questResult.data;

        const doctorName = latestAppt?.doctor.name || entities.lastBookedDoctorName || "your doctor";
        const hospitalName = latestAppt?.hospital.name || entities.lastBookedHospitalName || "the clinic";

        replyText = `You can complete your pre-visit clinical questionnaire directly on the right-hand panel of this screen under "Pre-Visit Intake Questionnaire". Please answer the brief health questions and click "Submit Pre-Visit Intake" so ${doctorName} can review your symptoms before your visit at ${hospitalName}. You can also access and complete it from your Patient Portal.`;
        break;
      }

      case "APPOINTMENT_STATUS": {
        const confirmedAppts = await prisma.appointment.findMany({
          where: { patientId, status: "CONFIRMED" },
          orderBy: { startTime: "asc" },
          include: {
            doctor: { include: { specialty: true } },
            hospital: true,
          },
        });

        if (confirmedAppts.length === 0) {
          replyText = "You currently have no scheduled appointments. Would you like me to help you find a doctor and book an appointment?";
        } else {
          const list = confirmedAppts.map((a) => {
            const d = new Date(a.startTime);
            const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            return `${a.doctor.name} (${a.doctor.specialty.name} at ${a.hospital.name}) on ${dateStr} at ${timeStr}`;
          }).join("; ");

          replyText = `You have ${confirmedAppts.length === 1 ? "an" : confirmedAppts.length} upcoming confirmed appointment: ${list}. You can also view full details and manage this in your Patient Portal dashboard.`;
        }
        break;
      }

      case "PORTAL_NAVIGATION": {
        replyText = "You can use AuraCare to search specialist doctors, check real-time hospital schedules, book appointments, and complete pre-visit clinical questionnaires. You can navigate between the AI Voice Assistant, your Patient Portal (to view all confirmed bookings and medical history), and the Hospital Admin Dashboard using the navigation bar at the top.";
        break;
      }

      case "GRATITUDE": {
        replyText = "You're very welcome! If you need to make any changes or have any questions before your appointment, feel free to let me know. Have a wonderful day!";
        break;
      }

      case "CANCEL": {
        const appt = await prisma.appointment.findFirst({
          where: { patientId, status: "CONFIRMED" },
          include: { doctor: true },
        });

        if (!appt) {
          replyText = "I couldn't find an active confirmed appointment under your name to cancel.";
        } else {
          const cancelResult = await CapabilityManager.execute(
            "cancel_appointment",
            { appointmentId: appt.id, reason: "Patient cancelled via AI Voice Agent" },
            corrId,
            conversationId
          );
          capabilityCalled = "cancel_appointment";
          capabilityResultData = cancelResult;
          replyText = `Your appointment with ${appt.doctor.name} has been cancelled, and the slot has been released.`;
        }
        break;
      }

      default: {
        replyText =
          "I am your healthcare intake assistant. You can tell me what symptoms or doctor you'd like to see, such as: 'I need to see an orthopedic doctor for my shoulder pain this Friday.' How can I help you today?";
        break;
      }
    }

    await this.saveTranscript(conversation.id, userMessage, replyText);

    return {
      replyText,
      actionTaken,
      capabilityCalled,
      capabilityResult: capabilityResultData,
      correlationId: corrId,
      latencyMs: Date.now() - startTimeMs,
    };
  }

  /**
   * Safe administrative NLU & symptom matching without clinical diagnosis (PRD Section 20).
   */
  private static parseUserInput(input: string, context: Record<string, any>): NluParseResult {
    const text = input.toLowerCase().trim();

    // 1. Clinical safety violation check (refuse medical advice / diagnosis / prescriptions)
    const medicalAdviceTriggers = [
      "do i have",
      "what disease",
      "diagnose me",
      "what medication",
      "should i take ibuprofen",
      "what drugs",
      "cure for",
      "how to treat",
      "am i dying",
    ];

    if (medicalAdviceTriggers.some((t) => text.includes(t))) {
      return { intent: "CLINICAL_QUERY_REJECTED", isClinicalViolation: true };
    }

    // 2. Gratitude & Closing Intent
    const gratitudePhrases = [
      "thank you",
      "thanks",
      "thank you so much",
      "thanks a lot",
      "that's all",
      "that is all",
      "that will be all",
      "all set",
      "goodbye",
      "bye",
      "have a good day",
      "have a great day",
      "nothing else",
      "no that's all",
      "no thanks",
      "that's it",
      "thats all",
      "thats it",
    ];

    if (
      gratitudePhrases.some(
        (p) => text === p || text.startsWith(p + " ") || text.endsWith(" " + p) || text === p + "."
      ) &&
      !text.includes("book") &&
      !text.includes("doctor") &&
      !text.includes("appointment") &&
      !text.includes("pain") &&
      !text.includes("rash")
    ) {
      return { intent: "GRATITUDE" };
    }

    // 3. Pre-Visit Intake Questionnaire Queries (PRD Section 15)
    // Matches explicit questionnaire inquiries, forms, and common STT phonetic variants like "three visiting question"
    const questionnaireKeywords = [
      "questionnaire",
      "questionair",
      "questionaire",
      "intake form",
      "intake question",
      "pre-visit",
      "pre visit",
      "visiting question",
      "three visiting",
      "three visit",
      "intake survey",
      "medical questionnaire",
      "clinical questionnaire",
      "previsit",
    ];

    const isAskingWhereOrHow =
      text.includes("where") ||
      text.includes("how") ||
      text.includes("find") ||
      text.includes("fill") ||
      text.includes("complete") ||
      text.includes("submit") ||
      text.includes("see") ||
      text.includes("open") ||
      text.includes("access");

    const isQuestionnaireQuery =
      questionnaireKeywords.some((k) => text.includes(k)) ||
      (isAskingWhereOrHow &&
        (text.includes("question") ||
          text.includes("form") ||
          text.includes("survey") ||
          text.includes("intake") ||
          text.includes("assessment"))) ||
      ((text.includes("where should i") ||
        text.includes("where do i") ||
        text.includes("where can i") ||
        text.includes("how do i") ||
        text.includes("how can i") ||
        text.includes("where to")) &&
        (text.includes("complete") ||
          text.includes("fill") ||
          text.includes("submit") ||
          text.includes("do that") ||
          text.includes("do this") ||
          text.includes("that")));

    if (isQuestionnaireQuery) {
      return { intent: "QUESTIONNAIRE_INFO" };
    }

    // 4. Appointment Status & Existing Booking Queries
    const statusPhrases = [
      "when is my appointment",
      "what time is my appointment",
      "my appointment time",
      "what date is my appointment",
      "where is my appointment",
      "view my appointment",
      "show my appointment",
      "check my appointment",
      "is my appointment confirmed",
      "appointment status",
      "appointment details",
      "do i have an appointment",
      "what doctor am i seeing",
      "check my booking",
      "show my booking",
      "view my booking",
      "my booking",
    ];

    const isStatusQuery =
      statusPhrases.some((p) => text.includes(p)) ||
      ((text.includes("when") ||
        text.includes("what time") ||
        text.includes("check") ||
        text.includes("view") ||
        text.includes("show") ||
        text.includes("see")) &&
        (text.includes("appointment") || text.includes("booking")) &&
        !text.includes("book") &&
        !text.includes("schedule") &&
        !text.includes("make"));

    if (isStatusQuery) {
      return { intent: "APPOINTMENT_STATUS" };
    }

    // 5. Platform Navigation & Guide Queries
    const navigationPhrases = [
      "how to use this website",
      "how does this work",
      "how does auracare work",
      "how does this app work",
      "what can you do",
      "what else can you do",
      "where is the patient portal",
      "where is the portal",
      "patient portal",
      "hospital admin",
      "how do i see my records",
      "where are your hospitals",
      "which hospitals",
      "what services do you offer",
      "how can you help me",
    ];

    if (navigationPhrases.some((p) => text.includes(p))) {
      return { intent: "PORTAL_NAVIGATION" };
    }

    // 6. Cancellation Intent
    if (text.includes("cancel") || text.includes("don't want the appointment")) {
      return { intent: "CANCEL" };
    }

    // 7. Reschedule / Timing Modification Flag
    const isExplicitReschedule =
      text.includes("reschedule") ||
      text.includes("change time") ||
      text.includes("change timing") ||
      text.includes("change timings") ||
      text.includes("change the time") ||
      text.includes("change the timing") ||
      text.includes("change the timings") ||
      text.includes("change the appointment") ||
      text.includes("change appointment") ||
      text.includes("move my appointment") ||
      text.includes("move the appointment") ||
      text.includes("move it to") ||
      text.includes("move to") ||
      text.includes("different time") ||
      text.includes("another time") ||
      text.includes("different slot") ||
      text.includes("another slot");

    // 8. Doctor Name Extraction
    let doctorName: string | undefined = undefined;
    if (text.includes("rao") || text.includes("ananya")) doctorName = "Dr. Ananya Rao";
    else if (text.includes("chen") || text.includes("marcus")) doctorName = "Dr. Marcus Chen";
    else if (text.includes("patel") || text.includes("sarah")) doctorName = "Dr. Sarah Patel";
    else if (text.includes("kim") || text.includes("david")) doctorName = "Dr. David Kim";
    else if (text.includes("sterling") || text.includes("robert")) doctorName = "Dr. Robert Sterling";
    else if (text.includes("rostova") || text.includes("elena")) doctorName = "Dr. Elena Rostova";
    else if (text.includes("gupta") || text.includes("sanjay")) doctorName = "Dr. Sanjay Gupta";
    else if (text.includes("wang") || text.includes("lisa")) doctorName = "Dr. Lisa Wang";
    else if (text.includes("thorne") || text.includes("emily")) doctorName = "Dr. Emily Thorne";

    // 9. Comprehensive Clinical Specialty & Symptom Taxonomy
    let specialtyKeyword: string | undefined = undefined;

    // ENT (Otolaryngology) - Ear, Nose, Throat, Hearing, Sinus, Balance
    const entKeywords = [
      "ear", "ears", "ear problem", "ear problems", "water went into", "water in ear", "water in my ear",
      "swimmer ear", "swimmer's ear", "earache", "ear ache", "ear pain", "clogged ear", "blocked ear",
      "muffled hearing", "hearing loss", "hearing", "hard of hearing", "can't hear", "tinnitus",
      "ringing in ear", "ringing in ears", "ringing ears", "ear infection", "earwax", "ear wax",
      "wax buildup", "eardrum", "perforated eardrum", "middle ear", "inner ear", "ear drainage",
      "drainage from ear", "discharge from ear", "sinus", "sinuses", "sinusitis", "sinus pain",
      "sinus pressure", "nose", "nasal", "nasal congestion", "stuffy nose", "runny nose", "congestion",
      "nosebleed", "nose bleed", "loss of smell", "anosmia", "deviated septum", "tonsil", "tonsils",
      "tonsillitis", "strep", "strep throat", "sore throat", "throat pain", "throat", "hoarse",
      "hoarseness", "lost voice", "loss of voice", "vocal cord", "larynx", "swallowing pain",
      "difficulty swallowing", "dysphagia", "vertigo", "ent", "otolaryngolog", "otolaryngologist",
      "ear nose throat", "ear nose and throat"
    ];

    // Ophthalmology - Eye & Vision Care
    const ophthKeywords = [
      "eye", "eyes", "eye problem", "eye problems", "eye pain", "blurry vision", "blurred vision",
      "vision loss", "loss of vision", "can't see", "double vision", "red eye", "red eyes", "pink eye",
      "conjunctivitis", "watery eyes", "dry eyes", "dry eye", "itchy eyes", "stye", "eyelid",
      "swollen eyelid", "cataract", "glaucoma", "retina", "retinal", "cornea", "corneal", "floaters",
      "flashes of light", "ophthalmolog", "ophthalmologist", "optometrist", "eye doctor", "vision"
    ];

    // Neurology - Brain, Nerves, Spine, Neurological Function
    const neuroKeywords = [
      "neurolog", "neurologist", "nerve", "nerves", "nerve pain", "numbness", "tingling",
      "pins and needles", "neuropathy", "peripheral neuropathy", "tremor", "tremors", "shaking",
      "shaking hands", "seizure", "seizures", "epilepsy", "concussion", "head injury", "memory loss",
      "dementia", "alzheimer", "migraine", "severe migraine", "cluster headache", "chronic headache",
      "bell's palsy", "facial numbness", "facial droop", "multiple sclerosis", "parkinson", "parkinsons",
      "sciatica", "pinched nerve", "loss of balance", "ataxia"
    ];

    // Gastroenterology - Digestive Health, Stomach, GI Tract, Liver
    const gastroKeywords = [
      "gastro", "gastroenterolog", "gastroenterologist", "acid reflux", "gerd", "heartburn",
      "indigestion", "burning in stomach", "stomach burning", "gastritis", "stomach ulcer", "ulcer",
      "peptic ulcer", "stomach pain", "severe stomach ache", "severe abdominal pain", "chronic diarrhea",
      "constipation", "bloating", "irritable bowel", "ibs", "crohn", "crohns", "colitis", "celiac",
      "gallbladder", "gallstones", "liver", "hepatitis", "jaundice", "blood in stool", "rectal bleeding",
      "digestive", "endoscopy", "colonoscopy"
    ];

    // Pediatrics - Infants, Children, Adolescents
    const pediatricKeywords = [
      "pediatric", "pediatrician", "paediatric", "child", "children", "infant", "infants",
      "baby", "babies", "toddler", "toddlers", "kid", "kids", "newborn", "newborns",
      "childhood vaccination", "childhood vaccines", "well child", "child fever", "baby fever",
      "growth milestones", "pediatric clinic"
    ];

    // Pulmonology - Lungs & Respiratory
    const pulmonoKeywords = [
      "pulmonolog", "pulmonologist", "lung", "lungs", "respiratory", "asthma", "asthma attack",
      "wheezing", "chronic bronchitis", "bronchitis", "copd", "emphysema", "pneumonia",
      "persistent cough", "chronic cough", "coughing up blood", "shortness of breath", "trouble breathing",
      "difficulty breathing", "breathless", "breathing problem", "sleep apnea"
    ];

    // Dermatology - Skin, Hair, Nails
    const dermaKeywords = [
      "skin rash", "skin rashes", "skinny lashes", "skin", "rash", "rashes",
      "itch", "itching", "itchy", "derma", "dermatol", "dermatologist", "dermatology",
      "acne", "pimple", "pimples", "eczema", "hive", "hives", "mole", "moles",
      "lesion", "lesions", "dermatitis", "psoriasis", "blister", "blisters",
      "skin allergy", "skin irritation", "melanoma", "skin cancer", "wart", "warts"
    ];

    // Orthopedics - Bones, Joints, Spine, Musculoskeletal
    const orthoKeywords = [
      "shoulder", "knee", "joint", "joints", "bone", "bones", "back pain", "lower back",
      "spine", "ortho", "orthopedic", "orthopaedics", "orthopedist", "fracture", "broken bone",
      "broken arm", "broken leg", "broken wrist", "ligament", "torn acl", "torn meniscus",
      "sprain", "dislocation", "tendon", "tendonitis", "arthritis", "osteoarthritis", "neck pain",
      "hip pain", "hip replacement", "ankle", "wrist", "elbow", "musculoskeletal", "orthopedic surgeon",
      "foot", "feet", "toe", "toes", "heel", "finger", "fingers", "hand", "hands", "arm", "arms",
      "leg", "legs", "muscle", "muscles", "muscle spasm", "muscle pain", "stiffness"
    ];

    // Cardiology - Heart & Cardiovascular
    const cardioKeywords = [
      "chest pain", "chest discomfort", "chest pressure", "chest tightness", "heart", "cardio",
      "cardiology", "cardiologist", "palpitation", "palpitations", "irregular heartbeat",
      "arrhythmia", "racing heart", "shortness of breath on exertion", "cardiac", "angina",
      "hypertension", "high blood pressure", "heart failure"
    ];

    // General Medicine - Primary Care & Constitutional Symptoms
    const generalKeywords = [
      "fever", "cough", "cold", "flu", "headache", "mild headache", "stomach", "belly",
      "nausea", "nauseous", "nauseated", "vomit", "vomiting", "diarrhea", "sick", "physician",
      "primary care", "primary care doctor", "internal medicine", "checkup", "annual checkup",
      "annual physical", "routine physical", "fatigue", "weakness", "infection", "dizzy",
      "dizziness", "lightheaded", "abdominal", "cramp", "cramps", "body ache", "body pain",
      "chills", "feeling sick", "general practitioner", "gp", "doctor check"
    ];

    const matchTerm = (term: string) => {
      if (term.length <= 4) {
        return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
      }
      return text.includes(term);
    };

    // Unsupported / External Referral Specialties (PRD Section 1: Referral triage)
    const dentalKeywords = [
      "tooth", "teeth", "toothache", "tooth pain", "dentist", "dental", "cavity",
      "cavities", "wisdom tooth", "gum", "gums", "bleeding gums", "orthodontist", "braces"
    ];

    const psychKeywords = [
      "depress", "depression", "depressed", "anxiety", "anxious", "panic attack",
      "panic attacks", "mental health", "therapy", "therapist", "psychiatrist",
      "psychology", "psychologist", "bipolar", "ptsd", "counseling", "counselor",
      "suicidal", "want to die", "self harm"
    ];

    const urologyKeywords = [
      "urolog", "urologist", "kidney stone", "kidney stones", "kidney pain",
      "urinary tract", "uti", "painful urination", "burning urination", "prostate",
      "blood in urine", "hematuria", "bladder"
    ];

    const obgynKeywords = [
      "gynecol", "gynecologist", "obgyn", "ob-gyn", "pregnant", "pregnancy",
      "prenatal", "menstrual", "period cramp", "period cramps", "pelvic pain",
      "pap smear", "womens health"
    ];

    const oncologyKeywords = [
      "oncolog", "oncologist", "cancer", "tumor", "chemotherapy", "chemo",
      "radiation therapy", "malignant", "biopsy"
    ];

    if (dentalKeywords.some(matchTerm)) {
      return { intent: "UNSUPPORTED_SPECIALTY", unsupportedSpecialty: "DENTAL" };
    }
    if (psychKeywords.some(matchTerm)) {
      return { intent: "UNSUPPORTED_SPECIALTY", unsupportedSpecialty: "PSYCHIATRY" };
    }
    if (urologyKeywords.some(matchTerm)) {
      return { intent: "UNSUPPORTED_SPECIALTY", unsupportedSpecialty: "UROLOGY" };
    }
    if (obgynKeywords.some(matchTerm)) {
      return { intent: "UNSUPPORTED_SPECIALTY", unsupportedSpecialty: "OBGYN" };
    }
    if (oncologyKeywords.some(matchTerm)) {
      return { intent: "UNSUPPORTED_SPECIALTY", unsupportedSpecialty: "ONCOLOGY" };
    }

    // Priority-ordered matching (specific organ systems first, then broad general medicine)
    if (entKeywords.some(matchTerm)) {
      specialtyKeyword = "ENT (Otolaryngology)";
    } else if (ophthKeywords.some(matchTerm)) {
      specialtyKeyword = "Ophthalmology";
    } else if (neuroKeywords.some(matchTerm)) {
      specialtyKeyword = "Neurology";
    } else if (gastroKeywords.some(matchTerm)) {
      specialtyKeyword = "Gastroenterology";
    } else if (pediatricKeywords.some(matchTerm)) {
      specialtyKeyword = "Pediatrics";
    } else if (pulmonoKeywords.some(matchTerm)) {
      specialtyKeyword = "Pulmonology";
    } else if (cardioKeywords.some(matchTerm)) {
      specialtyKeyword = "Cardiology";
    } else if (orthoKeywords.some(matchTerm)) {
      specialtyKeyword = "Orthopedics";
    } else if (dermaKeywords.some(matchTerm)) {
      specialtyKeyword = "Dermatology";
    } else if (generalKeywords.some(matchTerm)) {
      specialtyKeyword = "General Medicine";
    } else {
      // General Clinical Triage Indicator Fallback:
      // If patient describes general pain, discomfort, or symptoms that don't match a specialized organ,
      // route to General Medicine (Primary Care Provider / Dr. David Kim) as standard clinical triage practice.
      const healthIndicators = [
        "pain", "hurts", "hurt", "aching", "ache", "sore", "soreness", "swollen", "swelling",
        "burning", "burns", "bleeding", "bleed", "fever", "spasm", "spasms", "cramp", "cramps",
        "unwell", "sick", "feeling sick", "fatigue", "exhausted", "exhaustion", "weak", "weakness",
        "symptom", "symptoms", "health issue", "health concern", "medical issue", "problem",
        "injury", "injured", "hurt myself", "fell down", "accident"
      ];
      if (healthIndicators.some(matchTerm)) {
        specialtyKeyword = "General Medicine";
      }
    }

    // 10. Rejection and Alternative Day Detection
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

    let rejectedDay: string | undefined = undefined;

    // Check for explicit rejection of a day
    const rejectedDayMatch =
      text.match(
        /(?:cannot|can't|cant|couldn't|do not have|don't have|no time on|have plans on|plans on|busy on|not on|other than|except|won't work on|doesn't work on)\s+(?:a\s+time\s+on\s+|time\s+on\s+|an?\s+appointment\s+on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
      ) ||
      text.match(
        /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:doesn't|does not|won't|will not|is not|isn't)\s+(?:work|good|possible|convenient|an option)/i
      ) ||
      text.match(
        /(?:have\s+plans|busy)\s+(?:on\s+|this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
      ) ||
      text.match(/\bnot\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);

    if (rejectedDayMatch) {
      rejectedDay = rejectedDayMatch[1].toLowerCase();
    } else {
      // General check: if utterance contains negative/conflict words AND a day of week
      const hasConflict = /\b(?:cannot|can't|cant|couldn't|do not have|don't have|no time|have plans|plans|busy|not free|unavailable)\b/i.test(text);
      if (hasConflict) {
        for (const d of days) {
          if (text.includes(d)) {
            rejectedDay = d;
            break;
          }
        }
      }
    }

    const wantsAlternativeDay =
      Boolean(rejectedDay) ||
      /\b(?:another day|different day|other day|some other day|any other day|next week|different time|another time|next monday|next tuesday|other dates?|reschedule)\b/i.test(text);

    const isRejectingSlotOrDay =
      Boolean(rejectedDay) ||
      wantsAlternativeDay ||
      /\b(?:cannot|can't|cant|couldn't|could not|don't want|do not want|not that|not this|won't work|doesn't work|does not work|none of those|not free|busy)\b/i.test(text);

    // If user rejected the day in general context (e.g. "I want another day", "I have plans") without naming the day:
    if (!rejectedDay && wantsAlternativeDay && context.timeframe) {
      rejectedDay = context.timeframe;
    }

    // Timeframe Extraction:
    let timeframe: string | undefined = undefined;

    // Check if user requested a specific non-rejected day (e.g. "I can't do Friday, can we do Monday?")
    for (const day of days) {
      if (text.includes(day) && day !== rejectedDay) {
        timeframe = day;
        break;
      }
    }

    if (!timeframe) {
      if (wantsAlternativeDay) {
        timeframe = "next_available";
      } else if (text.includes("tomorrow")) {
        timeframe = "tomorrow";
      } else if (text.includes("today")) {
        timeframe = "today";
      } else if (text.includes("this week")) {
        timeframe = "friday"; // default near-term opening
      }
    }

    // Post-confirmation acknowledgment or follow-up
    if (context.appointmentConfirmed && !doctorName && !specialtyKeyword) {
      const ackWords = ["ok", "okay", "got it", "perfect", "great", "sounds good", "alright", "sure thing", "noted", "cool", "done"];
      if (ackWords.some((w) => text === w || text.startsWith(w + " ") || text === w + ".")) {
        return { intent: "GRATITUDE" };
      }
      if (text.includes("next") || text.includes("now what") || text.includes("what should i do") || text.includes("where do i go")) {
        return { intent: "QUESTIONNAIRE_INFO" };
      }
    }

    // Reschedule & timing change detection
    const hasPreviousBooking = Boolean(
      context.appointmentConfirmed ||
      context.lastConfirmedAppointmentId ||
      context.lastBookedDoctorName
    );

    const requestedTime = AiAgentEngine.extractRequestedTime(text);

    const hasNewDayOrTimeOrSlot =
      Boolean(timeframe) ||
      Boolean(rejectedDay) ||
      Boolean(wantsAlternativeDay) ||
      Boolean(requestedTime) ||
      /\b(?:appointment|booking|slot|timing|time)\b/i.test(text);

    const isReschedulingExisting = hasPreviousBooking && (isExplicitReschedule || hasNewDayOrTimeOrSlot);

    // When user specifies a new specialty in this turn, do NOT inherit an incompatible previous doctor!
    // But when rescheduling or modifying timing of an existing booking, retain the previous doctor!
    let effectiveDoctor = doctorName;
    if (!effectiveDoctor) {
      if (!specialtyKeyword || context.specialtyKeyword === specialtyKeyword) {
        if (!context.appointmentConfirmed || isReschedulingExisting) {
          effectiveDoctor = context.doctorName || context.lastBookedDoctorName;
        }
      } else if (isReschedulingExisting && !specialtyKeyword) {
        effectiveDoctor = context.lastBookedDoctorName || context.doctorName;
      }
    }

    const effectiveSpecialty =
      specialtyKeyword ||
      (!context.appointmentConfirmed || isReschedulingExisting
        ? context.specialtyKeyword || context.lastBookedSpecialty
        : undefined);

    // PRD Core Principle 2: Clarification over guessing
    // If input is incomplete (e.g. "I have", "need appointment") or lacks doctor and symptom info, request clarification
    const vaguePhrases = [
      "hello", "hi", "hey", "help", "need an appointment", "see doctor",
      "book appointment", "appointment", "schedule appointment", "doctor",
      "i want an appointment", "i need a doctor", "can i book", "i need help",
      "make an appointment", "get an appointment"
    ];

    // When a doctor is already in conversation context or rescheduling, slot selections (e.g. "at 9 30", "10 o'clock")
    // or confirmations (e.g. "mind that", "that works", "yes") are valid choices, not vague inquiries!
    const positiveWords = ["yes", "sure", "ok", "okay", "book", "confirm", "fine", "yep", "mind that", "that works", "take", "first", "second", "third"];
    const isSlotOrConfirmation =
      !isRejectingSlotOrDay &&
      Boolean((context.doctorName || context.specialtyKeyword || isReschedulingExisting) && (!context.appointmentConfirmed || isReschedulingExisting)) &&
      (Boolean(requestedTime) ||
        /(?:\bat\s+)?\d{1,2}(?::|\s+)?\d{0,2}\s*(?:am|pm)?/i.test(text) ||
        positiveWords.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text)));

    const isVagueOrIncomplete =
      !isSlotOrConfirmation &&
      !isReschedulingExisting &&
      ((!context.doctorName && !context.lastBookedDoctorName && text.length < 6) ||
        text === "i have" ||
        (text.startsWith("i have ") && text.split(" ").length <= 3 && !specialtyKeyword) ||
        vaguePhrases.some((p) => text === p || text === p + " please" || text === p + " today"));

    if (isVagueOrIncomplete && !doctorName && !specialtyKeyword && (!context.doctorName || context.appointmentConfirmed) && !isReschedulingExisting) {
      return {
        intent: "CLARIFICATION_NEEDED",
      };
    }

    if (!effectiveDoctor && !effectiveSpecialty) {
      return {
        intent: "CLARIFICATION_NEEDED",
      };
    }

    return {
      intent: isExplicitReschedule || isReschedulingExisting ? "RESCHEDULE" : "BOOK_APPOINTMENT",
      doctorName: effectiveDoctor,
      specialtyKeyword: effectiveSpecialty,
      timeframe: timeframe || (rejectedDay || wantsAlternativeDay ? "next_available" : context.timeframe),
      rejectedDay,
      isRejectingSlotOrDay,
      wantsAlternativeDay,
      appointmentId: context.lastConfirmedAppointmentId,
    };
  }

  /**
   * Resolves natural dates (e.g. "Friday", "tomorrow") to an upcoming target Date.
   */
  private static resolveTargetDate(timeframe?: string): Date {
    const target = new Date();
    if (!timeframe) {
      // If weekend, advance to Monday
      if (target.getDay() === 0) target.setDate(target.getDate() + 1);
      else if (target.getDay() === 6) target.setDate(target.getDate() + 2);
      return target;
    }

    const tf = timeframe.toLowerCase();
    if (tf === "next week" || tf === "next_available") {
      const currentDay = target.getDay();
      let diff = 1 - currentDay; // advance to Monday
      if (diff <= 0) diff += 7; // Next Monday
      target.setDate(target.getDate() + diff);
      return target;
    }

    if (tf === "tomorrow") {
      target.setDate(target.getDate() + 1);
      if (target.getDay() === 0) target.setDate(target.getDate() + 1);
      if (target.getDay() === 6) target.setDate(target.getDate() + 2);
      return target;
    }

    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    if (dayMap[tf] !== undefined) {
      const targetDay = dayMap[tf];
      const currentDay = target.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      target.setDate(target.getDate() + diff);
    }

    return target;
  }

  /**
   * Intelligently parses explicit time expressions (e.g. "10 o'clock", "at 9 30", "10:00 AM", "9 am")
   * without confusing date numbers (e.g. "September 18") with time hours.
   */
  public static extractRequestedTime(text: string): { hour: number; minute: number; period: "AM" | "PM" | null } | null {
    const lower = text.toLowerCase();

    // 1. Explicit 10 o'clock or 10 oclock with optional AM/PM/morning/afternoon
    const oclockMatch = lower.match(/\b(\d{1,2})\s*o'?clock(?:\s*(in the morning|am|in the afternoon|in the evening|pm))?\b/i);
    if (oclockMatch) {
      const hour = parseInt(oclockMatch[1], 10);
      const modifier = oclockMatch[2] ? oclockMatch[2].toLowerCase() : "";
      let period: "AM" | "PM" | null = null;
      if (modifier.includes("morning") || modifier.includes("am")) {
        period = "AM";
      } else if (modifier.includes("afternoon") || modifier.includes("evening") || modifier.includes("pm")) {
        period = "PM";
      }
      return { hour, minute: 0, period };
    }

    // 2. Hour:minute with optional AM/PM (e.g. "9:30", "10:00 AM", "09:30")
    const colonMatch = lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
    if (colonMatch) {
      const hour = parseInt(colonMatch[1], 10);
      const minute = parseInt(colonMatch[2], 10);
      const period = colonMatch[3] ? (colonMatch[3].toUpperCase() as "AM" | "PM") : null;
      return { hour, minute, period };
    }

    // 3. "at 9 30", "9 30 am", or spoken "9 30"
    const spokenMinuteMatch =
      lower.match(/\bat\s+(\d{1,2})\s+(\d{2})\s*(am|pm)?\b/i) ||
      lower.match(/\b([1-9]|1[0-2])\s+([0-5]\d)\s*(am|pm)\b/i) ||
      lower.match(/\b([1-9]|1[0-2])\s+(00|15|30|45)\b/i);
    if (spokenMinuteMatch) {
      const hour = parseInt(spokenMinuteMatch[1], 10);
      const minute = parseInt(spokenMinuteMatch[2], 10);
      const period = spokenMinuteMatch[3] ? (spokenMinuteMatch[3].toUpperCase() as "AM" | "PM") : null;
      return { hour, minute, period };
    }

    // 4. "at 9" or "at 10" or "at 11"
    const atHourMatch = lower.match(/\bat\s+(\d{1,2})\s*(am|pm)?\b/i);
    if (atHourMatch) {
      const hour = parseInt(atHourMatch[1], 10);
      const period = atHourMatch[2] ? (atHourMatch[2].toUpperCase() as "AM" | "PM") : null;
      return { hour, minute: 0, period };
    }

    // 5. "9 am", "10 pm", "10am", "9am"
    const amPmMatch = lower.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    if (amPmMatch) {
      const hour = parseInt(amPmMatch[1], 10);
      const period = amPmMatch[2].toUpperCase() as "AM" | "PM";
      return { hour, minute: 0, period };
    }

    return null;
  }

  private static async saveTranscript(conversationId: string, userMsg: string, aiReply: string) {
    const conv = await prisma.aiConversation.findUnique({ where: { id: conversationId } });
    if (!conv) return;

    const transcript = JSON.parse(conv.transcriptJson || "[]");
    transcript.push({ role: "patient", message: userMsg, timestamp: new Date().toISOString() });
    transcript.push({ role: "assistant", message: aiReply, timestamp: new Date().toISOString() });

    await prisma.aiConversation.update({
      where: { id: conversationId },
      data: { transcriptJson: JSON.stringify(transcript) },
    });
  }
}