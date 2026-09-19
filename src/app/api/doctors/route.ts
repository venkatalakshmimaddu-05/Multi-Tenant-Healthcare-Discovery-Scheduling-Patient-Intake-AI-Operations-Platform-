export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");
    const hospitalId = searchParams.get("hospitalId");

    if (doctorId) {
      const doctor = await prisma.doctor.findUnique({
        where: { id: doctorId },
        include: {
          hospital: true,
          specialty: true,
          calendars: true,
          blockedSlots: { orderBy: { startTime: "asc" } },
          appointments: {
            include: { patient: true, questionnaireResponses: true },
            orderBy: { startTime: "asc" },
          },
        },
      });
      return NextResponse.json(doctor);
    }

    const doctors = await prisma.doctor.findMany({
      where: hospitalId ? { hospitalId } : {},
      include: {
        hospital: { select: { name: true, slug: true } },
        specialty: true,
        calendars: true,
        _count: { select: { appointments: true } },
      },
    });

    return NextResponse.json(doctors);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, doctorId, startTime, endTime, reason } = body;

    if (action === "BLOCK_SLOT") {
      const blocked = await prisma.blockedSlot.create({
        data: {
          doctorId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          reason: reason || "Doctor Leave / Emergency",
        },
      });
      return NextResponse.json(blocked);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}