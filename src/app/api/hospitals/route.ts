export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/auditService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const hospitals = await prisma.hospital.findMany({
      where: status ? { status } : {},
      include: {
        departments: true,
        doctors: { include: { specialty: true } },
        _count: { select: { appointments: true, doctors: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(hospitals);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { hospitalId, status, reviewNotes } = body;

    if (!hospitalId || !status) {
      return NextResponse.json({ error: "Missing hospitalId or status" }, { status: 400 });
    }

    const updated = await prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        status,
        ...(reviewNotes !== undefined ? { reviewNotes } : {}),
      },
    });

    await AuditService.record({
      correlationId: AuditService.generateCorrelationId("hosp-onboarding"),
      hospitalId,
      actorRole: "PLATFORM_ADMIN",
      action: `HOSPITAL_STATUS_${status}`,
      entityType: "HOSPITAL",
      entityId: hospitalId,
      details: { status, reviewNotes },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}