export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CapabilityManager } from "@/lib/services/capabilityManager";
import { AuditService } from "@/lib/services/auditService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get("appointmentId");
    const hospitalId = searchParams.get("hospitalId");

    if (appointmentId) {
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { doctor: { include: { specialty: true } }, hospital: true },
      });

      if (!appt) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }

      let questionnaire = await prisma.questionnaire.findFirst({
        where: {
          hospitalId: appt.hospitalId,
          OR: [{ specialtyId: appt.doctor.specialtyId }, { specialtyId: null }],
        },
        include: { specialty: true, hospital: { select: { id: true, name: true } } },
      });

      // Fallback 1: Match by specialty across hospitals
      if (!questionnaire && appt.doctor.specialtyId) {
        questionnaire = await prisma.questionnaire.findFirst({
          where: { specialtyId: appt.doctor.specialtyId },
          include: { specialty: true, hospital: { select: { id: true, name: true } } },
        });
      }

      // Fallback 2: General first questionnaire
      if (!questionnaire) {
        questionnaire = await prisma.questionnaire.findFirst({
          include: { specialty: true, hospital: { select: { id: true, name: true } } },
        });
      }

      const existingResponse = await prisma.questionnaireResponse.findFirst({
        where: { appointmentId },
      });

      return NextResponse.json({ questionnaire, existingResponse, appointment: appt });
    }

    const questionnaires = await prisma.questionnaire.findMany({
      where: hospitalId ? { hospitalId } : {},
      include: { specialty: true, hospital: { select: { name: true } } },
    });

    return NextResponse.json(questionnaires);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionnaireId, appointmentId, patientId, responses } = body;

    const correlationId = body.correlationId || AuditService.generateCorrelationId("quest");
    const result = await CapabilityManager.execute(
      "submit_questionnaire",
      {
        questionnaireId,
        appointmentId,
        patientId,
        responsesJson: responses,
      },
      correlationId
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}