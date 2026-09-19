export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { SchedulingService } from "@/lib/services/schedulingService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");
    const dateStr = searchParams.get("date");

    if (!doctorId) {
      return NextResponse.json({ error: "Missing doctorId parameter" }, { status: 400 });
    }

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const slots = await SchedulingService.getAvailableSlots(doctorId, targetDate);

    return NextResponse.json({ doctorId, date: targetDate.toISOString(), slots });
  } catch (err: any) {
    console.error("[API/scheduling/availability] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}