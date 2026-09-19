import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding healthcare platform database...');

  // Clean slate for complete idempotency
  await prisma.appointmentHistory.deleteMany();
  await prisma.workflowExecution.deleteMany();
  await prisma.questionnaireResponse.deleteMany();
  await prisma.reconciliationRecord.deleteMany();
  await prisma.integrationOperation.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.blockedSlot.deleteMany();
  await prisma.calendar.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.department.deleteMany();
  await prisma.specialty.deleteMany();
  await prisma.questionnaire.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.externalMapping.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.capabilityExecution.deleteMany();
  await prisma.aiContext.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userContext.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.hospital.deleteMany();

  // 1. Hospitals
  const metroHealth = await prisma.hospital.create({
    data: {
      name: 'Metro Health Medical Center',
      slug: 'metro-health',
      address: '100 Medical Center Way, Suite 400, New York, NY 10001',
      phone: '+1-212-555-0150',
      email: 'admin@metrohealth.org',
      status: 'APPROVED',
      operatingHours: JSON.stringify({
        weekdays: '08:00 - 18:00',
        saturday: '09:00 - 14:00',
        sunday: 'Closed'
      }),
      integrationConfig: JSON.stringify({
        ehrVendor: 'Epic Systems Mock Connector',
        endpoint: 'https://ehr.metrohealth.internal/fhir/r4',
        authType: 'MUTUAL_TLS_BEARER',
        verificationRequired: true
      })
    }
  });

  const cityCare = await prisma.hospital.create({
    data: {
      name: 'City Care General Hospital',
      slug: 'city-care',
      address: '742 Evergreen Terrace, Springfield, IL 62704',
      phone: '+1-217-555-0188',
      email: 'intake@citycarehealth.org',
      status: 'APPROVED',
      operatingHours: JSON.stringify({
        weekdays: '09:00 - 17:00',
        saturday: 'Closed',
        sunday: 'Closed'
      }),
      integrationConfig: JSON.stringify({
        ehrVendor: 'Cerner Millennium Mock Connector',
        endpoint: 'https://ehr.citycare.internal/api/v2',
        authType: 'OAUTH2',
        verificationRequired: true
      })
    }
  });

  const apexSpecialty = await prisma.hospital.create({
    data: {
      name: 'Apex Specialty Institute',
      slug: 'apex-specialty',
      address: '500 Innovation Blvd, Austin, TX 78701',
      phone: '+1-512-555-0133',
      email: 'onboarding@apexspecialty.com',
      status: 'UNDER_REVIEW', // For demonstrating Platform Admin onboarding review!
      reviewNotes: 'Pending proof of clinical facility license and HIPAA compliance sign-off.',
      operatingHours: JSON.stringify({ weekdays: '08:00 - 17:00' }),
      integrationConfig: JSON.stringify({ ehrVendor: 'AthenaHealth Connector' })
    }
  });

  // 2. Departments
  const deptOrtho = await prisma.department.create({
    data: {
      hospitalId: metroHealth.id,
      name: 'Orthopedic & Sports Medicine',
      description: 'Advanced joint replacement, trauma, sports rehabilitation, and musculoskeletal care.'
    }
  });

  const deptCardio = await prisma.department.create({
    data: {
      hospitalId: metroHealth.id,
      name: 'Cardiovascular Health Institute',
      description: 'Comprehensive cardiology, electrophysiology, and preventative cardiac health.'
    }
  });

  const deptDerma = await prisma.department.create({
    data: {
      hospitalId: cityCare.id,
      name: 'Dermatology & Skin Clinic',
      description: 'General dermatology, skin lesions, rash assessment, and dermatological surgery.'
    }
  });

  const deptGeneral = await prisma.department.create({
    data: {
      hospitalId: cityCare.id,
      name: 'Primary Care & Internal Medicine',
      description: 'Comprehensive adult health, acute illness evaluation, and chronic disease management.'
    }
  });

  const deptENT = await prisma.department.create({
    data: {
      hospitalId: metroHealth.id,
      name: 'Otolaryngology & Head & Neck Center',
      description: 'Comprehensive medical and surgical ear, nose, throat (ENT), hearing, and balance care.'
    }
  });

  const deptOphth = await prisma.department.create({
    data: {
      hospitalId: cityCare.id,
      name: 'Ophthalmology & Vision Health Institute',
      description: 'Medical and surgical eye care, ocular pathology, and vision assessments.'
    }
  });

  const deptNeuro = await prisma.department.create({
    data: {
      hospitalId: metroHealth.id,
      name: 'Neurology & Brain Sciences',
      description: 'Advanced diagnosis and care for neurological disorders, nerve conditions, and headaches.'
    }
  });

  const deptGastro = await prisma.department.create({
    data: {
      hospitalId: cityCare.id,
      name: 'Gastroenterology & Digestive Health',
      description: 'Digestive tract care, acid reflux, stomach evaluation, and endoscopic diagnostics.'
    }
  });

  const deptPediatrics = await prisma.department.create({
    data: {
      hospitalId: cityCare.id,
      name: 'Pediatrics & Adolescent Medicine',
      description: 'Comprehensive primary and preventive healthcare for infants, children, and teenagers.'
    }
  });

  // 3. Specialties
  const specOrtho = await prisma.specialty.create({
    data: {
      name: 'Orthopedics',
      category: 'Surgical & Musculoskeletal',
      symptomKeywords: 'shoulder,arm,joint,knee,bone,fracture,ligament,spine,orthopedic,back,shoulder pain,knee pain,ankle',
      description: 'Musculoskeletal and joint disorders, orthopedic trauma, and sports medicine.'
    }
  });

  const specCardio = await prisma.specialty.create({
    data: {
      name: 'Cardiology',
      category: 'Cardiovascular',
      symptomKeywords: 'chest,heart,palpitations,shortness of breath,chest discomfort,blood pressure,cardiac,hypertension',
      description: 'Disorders of the heart and blood vessels.'
    }
  });

  const specDerma = await prisma.specialty.create({
    data: {
      name: 'Dermatology',
      category: 'Integumentary',
      symptomKeywords: 'skin,rash,itching,eczema,dermatitis,mole,lesion,acne,psoriasis,hives',
      description: 'Diagnosis and medical management of skin, hair, and nail disorders.'
    }
  });

  const specGeneral = await prisma.specialty.create({
    data: {
      name: 'General Medicine',
      category: 'Primary Care',
      symptomKeywords: 'fever,cough,flu,headache,fatigue,weakness,cold,throat,stomach,nausea,vomiting,checkup',
      description: 'First-line medical evaluations, general adult medicine, and symptom triage.'
    }
  });

  const specENT = await prisma.specialty.create({
    data: {
      name: 'ENT (Otolaryngology)',
      category: 'Head & Neck',
      symptomKeywords: 'ear,ears,earache,hearing,tinnitus,sinus,tonsil,throat,ear pain,swimmer ear,water in ear,ear infection,nasal,vertigo,swallowing,hoarseness',
      description: 'Diagnosis and medical/surgical management of ear, nose, throat, hearing, and balance disorders.'
    }
  });

  const specOphth = await prisma.specialty.create({
    data: {
      name: 'Ophthalmology',
      category: 'Vision & Eye Care',
      symptomKeywords: 'eye,eyes,vision,blurry,cataract,glaucoma,pink eye,conjunctivitis,stye,cornea,retina,double vision',
      description: 'Medical and surgical eye care, vision disorders, and ocular diseases.'
    }
  });

  const specNeuro = await prisma.specialty.create({
    data: {
      name: 'Neurology',
      category: 'Neuroscience',
      symptomKeywords: 'brain,nerve,numbness,tingling,neuropathy,migraine,seizure,epilepsy,tremor,memory loss,balance',
      description: 'Diagnosis and treatment of diseases of the brain, spinal cord, and nervous system.'
    }
  });

  const specGastro = await prisma.specialty.create({
    data: {
      name: 'Gastroenterology',
      category: 'Digestive Health',
      symptomKeywords: 'stomach,digestive,acid reflux,gerd,heartburn,gastritis,ulcer,bloating,colon,liver,constipation,diarrhea',
      description: 'Diseases affecting the gastrointestinal tract, stomach, intestines, liver, and pancreas.'
    }
  });

  const specPediatrics = await prisma.specialty.create({
    data: {
      name: 'Pediatrics',
      category: 'Child Health',
      symptomKeywords: 'child,infant,baby,toddler,kid,newborn,pediatric,pediatrician,vaccination',
      description: 'Comprehensive medical care for infants, children, and adolescents.'
    }
  });

  // 4. Doctors
  const drRao = await prisma.doctor.create({
    data: {
      hospitalId: metroHealth.id,
      departmentId: deptOrtho.id,
      specialtyId: specOrtho.id,
      name: 'Dr. Ananya Rao, MD',
      qualifications: 'MD (Harvard), Board Certified Orthopedic Surgeon',
      experienceYears: 14,
      languages: 'English, Spanish',
      consultationTypes: 'IN_PERSON,VIDEO',
      durationMinutes: 30,
      externalProviderId: 'EXT-PROV-101',
      status: 'ACTIVE'
    }
  });

  const drChen = await prisma.doctor.create({
    data: {
      hospitalId: metroHealth.id,
      departmentId: deptCardio.id,
      specialtyId: specCardio.id,
      name: 'Dr. Marcus Chen, MD, FACC',
      qualifications: 'MD (Johns Hopkins), Fellowship in Interventional Cardiology',
      experienceYears: 16,
      languages: 'English, Mandarin',
      consultationTypes: 'IN_PERSON',
      durationMinutes: 30,
      externalProviderId: 'EXT-PROV-102',
      status: 'ACTIVE'
    }
  });

  const drPatel = await prisma.doctor.create({
    data: {
      hospitalId: cityCare.id,
      departmentId: deptDerma.id,
      specialtyId: specDerma.id,
      name: 'Dr. Sarah Patel, MD, FAAD',
      qualifications: 'MD (Stanford), Board Certified Dermatologist',
      experienceYears: 10,
      languages: 'English, Hindi',
      consultationTypes: 'IN_PERSON,VIDEO',
      durationMinutes: 30,
      externalProviderId: 'EXT-PROV-201',
      status: 'ACTIVE'
    }
  });

  const drKim = await prisma.doctor.create({
    data: {
      hospitalId: cityCare.id,
      departmentId: deptGeneral.id,
      specialtyId: specGeneral.id,
      name: 'Dr. David Kim, MD',
      qualifications: 'MD (Columbia), Board Certified Internal Medicine',
      experienceYears: 8,
      languages: 'English, Korean',
      consultationTypes: 'IN_PERSON,VIDEO',
      durationMinutes: 30,
      externalProviderId: 'EXT-PROV-202',
      status: 'ACTIVE'
    }
  });

  const drSterling = await prisma.doctor.create({
    data: {
      hospitalId: metroHealth.id,
      departmentId: deptENT.id,
      specialtyId: specENT.id,
      name: 'Dr. Robert Sterling, MD, FACS',
      qualifications: 'MD (Harvard), Board Certified Otolaryngologist (ENT Specialist)',
      experienceYears: 15,
      languages: 'English, French',
      consultationTypes: 'IN_PERSON,VIDEO',
      durationMinutes: 30,
      externalProviderId: 'EXT-PROV-103',
      status: 'ACTIVE'
    }
  });

  const drRostova = await prisma.doctor.create({
    data: {
      hospitalId: cityCare.id,
      departmentId: deptOphth.id,
      specialtyId: specOphth.id,
      name: 'Dr. Elena Rostova, MD',
      qualifications: 'MD (Johns Hopkins), Fellowship in Cornea & Refractive Surgery',
      experienceYears: 12,
      languages: 'English, Russian',
      consultationTypes: 'IN_PERSON,VIDEO',
      durationMinutes: 30,
      externalProviderId: 'EXT-PROV-203',
      status: 'ACTIVE'
    }
  });

  const drGupta = await prisma.doctor.create({
    data: {
      hospitalId: metroHealth.id,
      departmentId: deptNeuro.id,
      specialtyId: specNeuro.id,
      name: 'Dr. Sanjay Gupta, MD',
      qualifications: 'MD (Yale), Board Certified Neurologist',
      experienceYears: 18,
      languages: 'English, Hindi',
      consultationTypes: 'IN_PERSON,VIDEO',
      durationMinutes: 30,
      externalProviderId: 'EXT-PROV-104',
      status: 'ACTIVE'
    }
  });

  const drWang = await prisma.doctor.create({
    data: {
      hospitalId: cityCare.id,
      departmentId: deptGastro.id,
      specialtyId: specGastro.id,
      name: 'Dr. Lisa Wang, MD',
      qualifications: 'MD (UCSF), Board Certified Gastroenterologist',
      experienceYears: 11,
      languages: 'English, Mandarin',
      consultationTypes: 'IN_PERSON,VIDEO',
      durationMinutes: 30,
      externalProviderId: 'EXT-PROV-204',
      status: 'ACTIVE'
    }
  });

  const drThorne = await prisma.doctor.create({
    data: {
      hospitalId: cityCare.id,
      departmentId: deptPediatrics.id,
      specialtyId: specPediatrics.id,
      name: 'Dr. Emily Thorne, MD, FAAP',
      qualifications: 'MD (Penn), Board Certified Pediatrician',
      experienceYears: 9,
      languages: 'English',
      consultationTypes: 'IN_PERSON,VIDEO',
      durationMinutes: 30,
      externalProviderId: 'EXT-PROV-205',
      status: 'ACTIVE'
    }
  });

  // 5. Calendars (Working hours Mon-Fri 09:00 - 17:00)
  const doctors = [drRao, drChen, drPatel, drKim, drSterling, drRostova, drGupta, drWang, drThorne];
  for (const doc of doctors) {
    for (let day = 1; day <= 5; day++) {
      await prisma.calendar.create({
        data: {
          doctorId: doc.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          slotDurationMinutes: 30,
          isActive: true
        }
      });
    }
  }

  // 6. Blocked slot for Dr. Rao (Wednesday 12:00 to 14:00)
  const today = new Date();
  const blockedStart = new Date(today);
  blockedStart.setHours(12, 0, 0, 0);
  const blockedEnd = new Date(today);
  blockedEnd.setHours(14, 0, 0, 0);

  await prisma.blockedSlot.create({
    data: {
      doctorId: drRao.id,
      startTime: blockedStart,
      endTime: blockedEnd,
      reason: 'Scheduled Orthopedic Surgery & Resident Rounds'
    }
  });

  // 7. Patients
  const patientAlex = await prisma.patient.create({
    data: {
      name: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      phone: '+1-555-0199',
      dateOfBirth: '1988-04-12',
      communicationPreference: 'VOICE_SMS',
      externalPatientId: 'EXT-PAT-9001'
    }
  });

  const patientMaria = await prisma.patient.create({
    data: {
      name: 'Maria Garcia',
      email: 'maria.garcia@example.com',
      phone: '+1-555-0144',
      dateOfBirth: '1992-09-24',
      communicationPreference: 'EMAIL',
      externalPatientId: 'EXT-PAT-9002'
    }
  });

  // 8. User Context
  await prisma.userContext.create({
    data: {
      patientId: patientAlex.id,
      preferredDays: 'FRIDAY,THURSDAY',
      preferredTimeOfDay: 'MORNING',
      lastDiscoveredSpecialty: 'Orthopedics'
    }
  });

  // 9. Pre-Visit Questionnaires
  await prisma.questionnaire.create({
    data: {
      hospitalId: metroHealth.id,
      specialtyId: specOrtho.id,
      title: 'Orthopedic Intake & Functional Assessment',
      description: 'Please complete this clinical pre-visit questionnaire so Dr. Rao can review your mobility and injury history before your visit.',
      schemaJson: JSON.stringify([
        {
          id: 'q_injury_type',
          type: 'choice',
          prompt: 'Is this consultation for an acute sudden injury (e.g. sports/fall) or chronic ongoing pain?',
          options: ['Acute Sudden Injury', 'Chronic Ongoing Pain', 'Post-Surgical Follow-up', 'Second Opinion']
        },
        {
          id: 'q_pain_severity',
          type: 'numeric',
          prompt: 'On a scale of 1 to 10, how severe is your discomfort currently?',
          min: 1,
          max: 10
        },
        {
          id: 'q_prior_imaging',
          type: 'yes_no',
          prompt: 'Have you had an X-Ray, MRI, or CT scan done for this condition within the last 6 months?'
        },
        {
          id: 'q_mobility_aid',
          type: 'yes_no',
          prompt: 'Do you currently require crutches, a brace, walker, or wheelchair for mobility?'
        },
        {
          id: 'q_symptom_notes',
          type: 'long_text',
          prompt: 'Please describe any specific movements or positions that trigger or alleviate your pain.'
        }
      ])
    }
  });

  await prisma.questionnaire.create({
    data: {
      hospitalId: metroHealth.id,
      specialtyId: specCardio.id,
      title: 'Cardiovascular Pre-Consultation History',
      description: 'Comprehensive screening for upcoming cardiac consultation with Dr. Chen.',
      schemaJson: JSON.stringify([
        {
          id: 'q_hypertension',
          type: 'yes_no',
          prompt: 'Have you been formally diagnosed with high blood pressure (hypertension)?'
        },
        {
          id: 'q_chest_exertion',
          type: 'yes_no',
          prompt: 'Do you experience chest pressure or shortness of breath when walking up stairs or exercising?'
        },
        {
          id: 'q_cardiac_meds',
          type: 'short_text',
          prompt: 'List any cardiac or blood pressure medications you are currently taking (or type None).'
        }
      ])
    }
  });

  await prisma.questionnaire.create({
    data: {
      hospitalId: cityCare.id,
      specialtyId: specDerma.id,
      title: 'Dermatology Pre-Visit Intake & Rash Assessment',
      description: 'Please complete this clinical pre-visit intake questionnaire so Dr. Sarah Patel can review your skin condition and symptoms before your appointment.',
      schemaJson: JSON.stringify([
        {
          id: 'q_rash_duration',
          type: 'choice',
          prompt: 'How long have you been experiencing this skin rash or irritation?',
          options: ['Less than 3 days', '3 to 7 days', '1 to 4 weeks', 'More than a month']
        },
        {
          id: 'q_itch_severity',
          type: 'numeric',
          prompt: 'On a scale of 1 to 10, how severe is the itching or discomfort?',
          min: 1,
          max: 10
        },
        {
          id: 'q_topical_treatments',
          type: 'yes_no',
          prompt: 'Have you applied any topical ointments, hydrocortisone, or skin creams?'
        },
        {
          id: 'q_rash_location',
          type: 'long_text',
          prompt: 'Please describe the location of the rash and any potential triggers or allergies.'
        }
      ])
    }
  });

  await prisma.questionnaire.create({
    data: {
      hospitalId: cityCare.id,
      specialtyId: specGeneral.id,
      title: 'Primary Care & General Health Intake',
      description: 'Please review and submit your current medical symptoms before your consultation with Dr. David Kim.',
      schemaJson: JSON.stringify([
        {
          id: 'q_primary_concern',
          type: 'choice',
          prompt: 'What is the primary reason for your visit today?',
          options: ['Acute Illness (Cold, Fever, Flu)', 'Annual Physical / Checkup', 'Chronic Condition Management', 'Medication Refill']
        },
        {
          id: 'q_fever',
          type: 'yes_no',
          prompt: 'Have you had a fever or chills in the last 48 hours?'
        },
        {
          id: 'q_general_notes',
          type: 'long_text',
          prompt: 'Please list any other health concerns or symptoms you would like to discuss.'
        }
      ])
    }
  });

  await prisma.questionnaire.create({
    data: {
      hospitalId: metroHealth.id,
      specialtyId: specENT.id,
      title: 'ENT & Otolaryngology Pre-Visit Assessment',
      description: 'Please complete this clinical pre-visit questionnaire so Dr. Robert Sterling can review your ear, nose, throat, or hearing symptoms before your visit.',
      schemaJson: JSON.stringify([
        {
          id: 'q_primary_ent_area',
          type: 'choice',
          prompt: 'Which area is primarily affected?',
          options: ['Ears (Earache, Water in Ear, Hearing Loss, Ringing/Tinnitus)', 'Nose & Sinus (Congestion, Sinus Pain, Nosebleed)', 'Throat & Voice (Sore Throat, Hoarseness, Swallowing Pain)']
        },
        {
          id: 'q_water_or_infection',
          type: 'yes_no',
          prompt: 'Did water enter the ear or did symptoms start after swimming or showering?'
        },
        {
          id: 'q_hearing_change',
          type: 'choice',
          prompt: 'Have you noticed any change in your hearing?',
          options: ['No hearing change', 'Muffled hearing / Clogged sensation', 'Ringing / Tinnitus', 'Significant hearing reduction']
        },
        {
          id: 'q_drainage_discharge',
          type: 'yes_no',
          prompt: 'Is there any fluid drainage, discharge, or bleeding from the ear or nose?'
        },
        {
          id: 'q_ent_details',
          type: 'long_text',
          prompt: 'Please describe your symptoms and how long they have been occurring.'
        }
      ])
    }
  });

  await prisma.questionnaire.create({
    data: {
      hospitalId: cityCare.id,
      specialtyId: specOphth.id,
      title: 'Ophthalmology & Vision Care Intake',
      description: 'Please complete this questionnaire so Dr. Elena Rostova can evaluate your visual symptoms and eye health.',
      schemaJson: JSON.stringify([
        {
          id: 'q_eye_affected',
          type: 'choice',
          prompt: 'Which eye is experiencing issues?',
          options: ['Right Eye Only', 'Left Eye Only', 'Both Eyes']
        },
        {
          id: 'q_vision_changes',
          type: 'choice',
          prompt: 'Are you experiencing any vision impairment?',
          options: ['No vision changes', 'Blurry / Hazy vision', 'Double vision', 'Flashes of light or floaters', 'Sudden partial vision loss']
        },
        {
          id: 'q_eye_pain_redness',
          type: 'yes_no',
          prompt: 'Are you experiencing pain, burning, sensitivity to light, or significant redness?'
        },
        {
          id: 'q_eye_notes',
          type: 'long_text',
          prompt: 'Describe any previous eye surgeries, corrective lenses, or specific symptoms.'
        }
      ])
    }
  });

  await prisma.questionnaire.create({
    data: {
      hospitalId: metroHealth.id,
      specialtyId: specNeuro.id,
      title: 'Neurological Evaluation & Headache Intake',
      description: 'Please answer these questions so Dr. Sanjay Gupta can review your neurological symptoms before your visit.',
      schemaJson: JSON.stringify([
        {
          id: 'q_neuro_symptoms',
          type: 'choice',
          prompt: 'What is your primary neurological concern?',
          options: ['Severe Headache / Migraine', 'Numbness / Tingling / Neuropathy', 'Tremor / Involuntary Movement', 'Dizziness / Balance Issues', 'Seizure / Blackout History']
        },
        {
          id: 'q_symptom_frequency',
          type: 'choice',
          prompt: 'How often do these neurological symptoms occur?',
          options: ['Constant / Daily', 'Multiple times per week', 'Occasional episodes', 'First time occurrence']
        },
        {
          id: 'q_neuro_notes',
          type: 'long_text',
          prompt: 'Please provide any details on triggers, duration, and whether symptoms affect one or both sides of your body.'
        }
      ])
    }
  });

  await prisma.questionnaire.create({
    data: {
      hospitalId: cityCare.id,
      specialtyId: specGastro.id,
      title: 'Gastroenterology & Digestive Health Intake',
      description: 'Please complete this clinical screening so Dr. Lisa Wang can review your digestive symptoms before your appointment.',
      schemaJson: JSON.stringify([
        {
          id: 'q_gi_issue',
          type: 'choice',
          prompt: 'What is your chief digestive complaint?',
          options: ['Acid Reflux / Heartburn / GERD', 'Abdominal Pain / Cramping', 'Nausea / Vomiting', 'Chronic Diarrhea / Constipation', 'Bloating / Indigestion']
        },
        {
          id: 'q_meal_timing',
          type: 'choice',
          prompt: 'Are symptoms related to meals or empty stomach?',
          options: ['Worse after eating', 'Worse on empty stomach', 'Worse lying down at night', 'Constant regardless of food']
        },
        {
          id: 'q_gi_notes',
          type: 'long_text',
          prompt: 'Please list any medications, dietary intolerances, or previous GI procedures.'
        }
      ])
    }
  });

  await prisma.questionnaire.create({
    data: {
      hospitalId: cityCare.id,
      specialtyId: specPediatrics.id,
      title: 'Pediatric Pre-Visit Health Questionnaire',
      description: 'Please complete this intake for your child prior to their visit with Dr. Emily Thorne.',
      schemaJson: JSON.stringify([
        {
          id: 'q_child_age',
          type: 'choice',
          prompt: "What is your child's age group?",
          options: ['Infant (0 - 12 months)', 'Toddler (1 - 3 years)', 'Young Child (4 - 8 years)', 'Older Child / Adolescent (9 - 17 years)']
        },
        {
          id: 'q_child_fever',
          type: 'yes_no',
          prompt: 'Has your child had a fever in the last 24 hours?'
        },
        {
          id: 'q_pediatric_concern',
          type: 'long_text',
          prompt: 'Please describe the main concern or reason for your child’s visit today.'
        }
      ])
    }
  });

  // 10. Workflows
  await prisma.workflow.create({
    data: {
      hospitalId: metroHealth.id,
      triggerEvent: 'APPOINTMENT_BOOKED',
      name: 'Post-Booking Pre-Visit Questionnaire & SMS Confirmation',
      description: 'Automatically dispatches intake questionnaire to patient via SMS/Portal and alerts the attending doctor.',
      configJson: JSON.stringify({
        actions: [
          { type: 'SEND_CONFIRMATION_NOTIFICATION', channel: 'VOICE_SMS', delaySeconds: 0 },
          { type: 'ASSIGN_QUESTIONNAIRE', delaySeconds: 5 },
          { type: 'SCHEDULE_REMINDER', triggerBeforeHours: 24 }
        ]
      })
    }
  });

  await prisma.workflow.create({
    data: {
      hospitalId: cityCare.id,
      triggerEvent: 'APPOINTMENT_BOOKED',
      name: 'City Care Post-Booking Confirmation & Intake Workflow',
      description: 'Dispatches intake questionnaire and confirmation for City Care General Hospital appointments.',
      configJson: JSON.stringify({
        actions: [
          { type: 'SEND_CONFIRMATION_NOTIFICATION', channel: 'VOICE_SMS', delaySeconds: 0 },
          { type: 'ASSIGN_QUESTIONNAIRE', delaySeconds: 5 },
          { type: 'SCHEDULE_REMINDER', triggerBeforeHours: 24 }
        ]
      })
    }
  });

  // 11. External Mappings
  await prisma.externalMapping.createMany({
    data: [
      { entityType: 'PATIENT', internalId: patientAlex.id, externalId: 'EXT-PAT-9001', systemName: 'MOCK_EPIC_EHR' },
      { entityType: 'PATIENT', internalId: patientMaria.id, externalId: 'EXT-PAT-9002', systemName: 'MOCK_EPIC_EHR' },
      { entityType: 'DOCTOR', internalId: drRao.id, externalId: 'EXT-PROV-101', systemName: 'MOCK_EPIC_EHR' },
      { entityType: 'DOCTOR', internalId: drChen.id, externalId: 'EXT-PROV-102', systemName: 'MOCK_EPIC_EHR' },
      { entityType: 'DOCTOR', internalId: drPatel.id, externalId: 'EXT-PROV-201', systemName: 'MOCK_CERNER_EHR' },
      { entityType: 'DOCTOR', internalId: drKim.id, externalId: 'EXT-PROV-202', systemName: 'MOCK_CERNER_EHR' },
      { entityType: 'FACILITY', internalId: metroHealth.id, externalId: 'EXT-FAC-001', systemName: 'MOCK_EPIC_EHR' },
      { entityType: 'FACILITY', internalId: cityCare.id, externalId: 'EXT-FAC-002', systemName: 'MOCK_CERNER_EHR' }
    ]
  });

  console.log('Database seeded successfully with multi-tenant hospitals, doctors, specialties, calendars, and questionnaires!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });