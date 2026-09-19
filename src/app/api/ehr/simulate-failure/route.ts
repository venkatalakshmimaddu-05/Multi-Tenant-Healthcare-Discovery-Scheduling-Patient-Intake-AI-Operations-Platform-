import { NextRequest, NextResponse } from "next/server";
import { MockEhrService } from "@/lib/services/ehrIntegrationService";
import { EhrSimulationMode } from "@/lib/types";

export async function GET() {
  const currentMode = MockEhrService.getSimulationMode();
  return NextResponse.json({ mode: currentMode });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode } = body;

    const validModes: EhrSimulationMode[] = ["NORMAL", "TIMEOUT", "UNKNOWN_OUTCOME", "OUTAGE"];
    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: "Invalid simulation mode. Allowed: NORMAL, TIMEOUT, UNKNOWN_OUTCOME, OUTAGE" }, { status: 400 });
    }

    MockEhrService.setSimulationMode(mode);
    return NextResponse.json({ success: true, mode });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}