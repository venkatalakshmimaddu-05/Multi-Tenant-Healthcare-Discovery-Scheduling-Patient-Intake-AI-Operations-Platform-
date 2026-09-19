import { NextRequest, NextResponse } from "next/server";
import { AiAgentEngine } from "@/lib/services/aiAgentEngine";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const speechResult = formData.get("SpeechResult")?.toString() || "";
    const callSid = formData.get("CallSid")?.toString() || `call-${Date.now()}`;
    const callerPhone = formData.get("From")?.toString() || "+15551234567";

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const nextTurnUrl = `${protocol}://${host}/api/voice/twilio/handle-turn`;

    if (!speechResult.trim()) {
      const retryTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${nextTurnUrl}" method="POST" timeout="4" speechTimeout="auto">
    <Say voice="Polly.Joanna-Neural">I didn't quite catch that. Could you please repeat your symptoms or what doctor you need?</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Thank you for contacting AuraCare. Have a wonderful day!</Say>
</Response>`;
      return new NextResponse(retryTwiml, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Match patient by caller phone number or default to primary patient
    const patient =
      (await prisma.patient.findFirst({ where: { phone: callerPhone } })) ||
      (await prisma.patient.findFirst());
    const targetPatientId = patient?.id || "pat-default-alex";

    // Execute conversational AI engine turn
    const convId = `twilio-${callSid}`;
    const agentResponse = await AiAgentEngine.processTurn(
      convId,
      speechResult,
      targetPatientId
    );

    // Escape any XML special characters in the reply
    const escapedReply = agentResponse.replyText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // If turn resulted in confirmation or gratitude, conclude call politely
    const isCompleted =
      agentResponse.actionTaken === "APPOINTMENT_CONFIRMED" ||
      agentResponse.actionTaken === "APPOINTMENT_RESCHEDULED" ||
      escapedReply.toLowerCase().includes("wonderful day");

    const twiml = isCompleted
      ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${escapedReply}</Say>
  <Say voice="Polly.Joanna-Neural">We look forward to seeing you. Goodbye!</Say>
</Response>`
      : `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${nextTurnUrl}" method="POST" timeout="4" speechTimeout="auto">
    <Say voice="Polly.Joanna-Neural">${escapedReply}</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Thank you for calling AuraCare Health. Goodbye!</Say>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">We encountered an issue processing your request. Please hold while we transfer you to clinical support.</Say>
</Response>`;
    return new NextResponse(errorTwiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
