export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { REALTIME_TOOLS } from "@/lib/services/realtimeTools";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY is not set in environment or .env.local",
          requiresKey: true,
          message:
            "To enable live WebRTC streaming with OpenAI Realtime API (ChatGPT Voice Mode), please add your OPENAI_API_KEY to .env.local. Alternatively, you can use the built-in Web Voice mode which works locally for free.",
        },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: "alloy",
        instructions: `You are AuraCare AI, the intelligent administrative patient intake and scheduling access agent for AuraCare Health.
Your primary role is to assist patients in:
1. Discovering certified doctor specialists based on their reported symptoms or doctor name.
2. Checking verified hospital calendar availability.
3. Reserving and confirming verified appointments.
4. Directing patients to fill out the pre-visit intake questionnaire available on their right-hand drawer immediately after booking.

CRITICAL CLINICAL SAFETY BOUNDARY:
- You are strictly an administrative scheduling coordinator.
- NEVER provide medical diagnoses, assess life-threatening conditions, or prescribe medications.
- If a patient describes a severe emergency (e.g. unbearable chest pain, severe bleeding, stroke signs), immediately urge them to call 911.

CRITICAL SCHEDULING RULES:
- If a patient rejects a proposed day or time (e.g. "I cannot do Friday", "I have plans on Friday", "I want another day", "Friday does not work", "I do not have a time on Friday"), NEVER book that day.
- Instead, call check_availability for an alternative day (such as the next available weekday, e.g. Monday) and present those new openings.
- Only call create_appointment when the patient has explicitly selected and confirmed a specific date and time slot.

CONVERSATIONAL TONE:
- Speak naturally, warmly, empathetically, and concisely suited for real-time voice conversation.
- Use tool calls whenever querying doctors, checking availability, or booking appointments.`,
        tools: REALTIME_TOOLS,
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
        },
        input_audio_transcription: {
          model: "whisper-1",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Realtime Session Error]", errText);
      return NextResponse.json(
        { error: "Failed to create realtime session", details: errText },
        { status: response.status }
      );
    }

    const sessionData = await response.json();
    return NextResponse.json(sessionData);
  } catch (err: any) {
    console.error("[Realtime Session Exception]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
