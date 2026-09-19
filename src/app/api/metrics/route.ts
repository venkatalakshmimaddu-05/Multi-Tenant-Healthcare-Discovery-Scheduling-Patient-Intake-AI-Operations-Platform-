export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { MetricsService } from "@/lib/services/metricsService";

export async function GET() {
  try {
    const summary = await MetricsService.getSummary();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}