export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CapabilityManager } from "@/lib/services/capabilityManager";
import { AuditService } from "@/lib/services/auditService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const doctorId = searchParams.get("doctorId");
    const hospitalId = searchParams.get("hospitalId");

    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (hospitalId) where.hospitalId = hospitalId;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        doctor: { include: { specialty: true } },
        hospital: true,
        patient: true,
        history: { orderBy: { timestamp: "desc" } },
        questionnaireResponses: { include: { questionnaire: true } },
      },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json(appointments);
  } catch (err: any) {
    console.error("[API/appointments GET] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const correlationId = body.correlationId || AuditService.generateCorrelationId("manual-book");
    const result = await CapabilityManager.execute("create_appointment", body, correlationId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API/appointments POST] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, appointmentId, ...rest } = body;
    const correlationId = body.correlationId || AuditService.generateCorrelationId("apt-patch");

    if (action === "CANCEL") {
      const result = await CapabilityManager.execute(
        "cancel_appointment",
        { appointmentId, ...rest },
        correlationId
      );
      return NextResponse.json(result);
    } else if (action === "RESCHEDULE") {
      const result = await CapabilityManager.execute(
        "reschedule_appointment",
        { appointmentId, ...rest },
        correlationId
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[API/appointments PATCH] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}