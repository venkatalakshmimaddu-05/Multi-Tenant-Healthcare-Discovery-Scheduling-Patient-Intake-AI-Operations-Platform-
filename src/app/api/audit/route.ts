export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/auditService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const correlationId = searchParams.get("correlationId");

    if (correlationId) {
      const trace = await AuditService.getTrace(correlationId);
      return NextResponse.json(trace);
    }

    const hospitalId = searchParams.get("hospitalId");
    const actorRole = searchParams.get("actorRole");

    const events = await prisma.auditEvent.findMany({
      where: {
        ...(hospitalId ? { hospitalId } : {}),
        ...(actorRole ? { actorRole } : {}),
      },
      include: { hospital: { select: { name: true } } },
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    return NextResponse.json(events);
  } catch (err: any) {
    console.error("[API/audit] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}