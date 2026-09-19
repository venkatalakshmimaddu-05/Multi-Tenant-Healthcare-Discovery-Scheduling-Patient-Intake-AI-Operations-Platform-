import { NextRequest, NextResponse } from "next/server";
import { AiAgentEngine } from "@/lib/services/aiAgentEngine";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, message, patientId, correlationId } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    console.log(`[STT / Backend Received] Length: ${message.length} chars | Content: "${message}"`);

    let effectivePatientId = patientId;
    if (!effectivePatientId) {
      const defaultPatient = await prisma.patient.findFirst();
      effectivePatientId = defaultPatient?.id;
    }

    const convId = conversationId || `conv-${Date.now()}`;
    const result = await AiAgentEngine.processTurn(
      convId,
      message,
      effectivePatientId,
      correlationId
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API/ai/converse] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process turn" },
      { status: 500 }
    );
  }
}