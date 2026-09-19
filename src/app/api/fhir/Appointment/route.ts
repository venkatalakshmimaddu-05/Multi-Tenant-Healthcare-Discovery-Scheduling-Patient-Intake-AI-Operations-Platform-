import { NextRequest, NextResponse } from "next/server";
import { FhirConnector } from "@/lib/services/fhirConnector";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get("id");
    const hospitalId = searchParams.get("hospitalId");

    if (appointmentId) {
      const bundle = await FhirConnector.generateAppointmentBundle(appointmentId);
      if (!bundle) {
        return NextResponse.json(
          { resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-found", diagnostics: "Appointment not found" }] },
          { status: 404, headers: { "Content-Type": "application/fhir+json" } }
        );
      }
      return NextResponse.json(bundle, {
        headers: { "Content-Type": "application/fhir+json" },
      });
    }

    // List appointments as FHIR Bundle
    const appointments = await prisma.appointment.findMany({
      where: hospitalId ? { hospitalId } : {},
      include: {
        patient: true,
        doctor: { include: { specialty: true } },
        hospital: true,
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    const fhirEntries = appointments.map((appt) => ({
      fullUrl: `urn:uuid:${appt.id}`,
      resource: FhirConnector.toFhirAppointment(appt),
    }));

    const collectionBundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: appointments.length,
      entry: fhirEntries,
    };

    return NextResponse.json(collectionBundle, {
      headers: { "Content-Type": "application/fhir+json" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { resourceType: "OperationOutcome", issue: [{ severity: "fatal", code: "exception", diagnostics: error.message }] },
      { status: 500, headers: { "Content-Type": "application/fhir+json" } }
    );
  }
}
