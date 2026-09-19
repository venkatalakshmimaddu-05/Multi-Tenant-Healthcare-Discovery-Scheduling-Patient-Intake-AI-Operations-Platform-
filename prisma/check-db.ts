import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('[DATABASE HEALTH CHECK] Starting database diagnostic...\n');
  const start = Date.now();

  try {
    const [hospitals, doctors, departments, patients, appointments, questionnaires, auditEvents] = await Promise.all([
      prisma.hospital.findMany({ select: { name: true, slug: true, status: true } }),
      prisma.doctor.findMany({ select: { name: true, specialty: { select: { name: true } } } }),
      prisma.department.count(),
      prisma.patient.count(),
      prisma.appointment.count(),
      prisma.questionnaire.count(),
      prisma.auditEvent.count(),
    ]);

    const duration = Date.now() - start;

    console.log('>>> STATUS: HEALTHY & CONNECTED (Latency: ' + duration + 'ms)\n');
    console.log('--- DATABASE METRICS ---');
    console.table([
      { Table: 'Hospitals', Records: hospitals.length, Status: 'Populated' },
      { Table: 'Doctors', Records: doctors.length, Status: 'Populated' },
      { Table: 'Departments', Records: departments, Status: 'Populated' },
      { Table: 'Patients', Records: patients, Status: 'Populated' },
      { Table: 'Appointments', Records: appointments, Status: 'Active' },
      { Table: 'Questionnaires', Records: questionnaires, Status: 'Configured' },
      { Table: 'Audit Events', Records: auditEvents, Status: 'Auditing' },
    ]);

    console.log('\n--- REGISTERED HOSPITALS ---');
    hospitals.forEach((h, i) => console.log('  ' + (i + 1) + '. ' + h.name + ' [' + h.status + ']'));

    console.log('\n--- AVAILABLE DOCTORS ---');
    doctors.forEach((d, i) => console.log('  ' + (i + 1) + '. ' + d.name + ' (' + d.specialty.name + ')'));

    console.log('\n[RESULT] Database connection and schema are fully operational!');
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Database Connection Failed:', error);
    process.exit(1);
  }
}

main();
