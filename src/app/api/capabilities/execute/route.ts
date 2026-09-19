import { NextRequest, NextResponse } from "next/server";
import { CapabilityManager } from "@/lib/services/capabilityManager";
import { AuditService } from "@/lib/services/auditService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { capability, params = {}, correlationId, conversationId } = body;

    if (!capability) {
      return NextResponse.json({ error: "Missing capability name" }, { status: 400 });
    }

    const corrId = correlationId || AuditService.generateCorrelationId("cap");
    const result = await CapabilityManager.execute(capability, params, corrId, conversationId);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API/capabilities/execute] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}