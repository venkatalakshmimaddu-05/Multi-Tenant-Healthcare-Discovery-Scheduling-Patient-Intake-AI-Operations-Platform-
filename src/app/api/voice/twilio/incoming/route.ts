import { NextRequest, NextResponse } from "next/server";

/**
 * Inbound Twilio Voice Webhook.
 * Responds with standard TwiML to initiate interactive voice triage.
 */
export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const turnActionUrl = `${protocol}://${host}/api/voice/twilio/handle-turn`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">
    Hello! Thank you for calling AuraCare Patient Access. I am your autonomous clinical intake assistant. 
    You can tell me what medical symptoms you are having, or which doctor you would like to see.
  </Say>
  <Gather input="speech" action="${turnActionUrl}" method="POST" timeout="4" speechTimeout="auto">
    <Say voice="Polly.Joanna-Neural">Please describe how I can help you today.</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">We didn't receive any input. If you need assistance, please call back. Goodbye!</Say>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">AuraCare voice services are temporarily experiencing a delay. Please try again shortly.</Say>
</Response>`;
    return new NextResponse(fallbackTwiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
