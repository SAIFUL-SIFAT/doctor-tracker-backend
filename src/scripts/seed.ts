import mongoose from 'mongoose';
import argon2 from 'argon2';
import { faker } from '@faker-js/faker';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../modules/auth/user.model.js';
import { Doctor } from '../modules/doctors/doctor.model.js';
import { Patient } from '../modules/patients/patient.model.js';
import { RefreshToken } from '../modules/auth/refreshToken.model.js';
import { SPECIALIZATIONS, CONDITIONS, GENDERS, PATIENT_STATUSES } from '../config/constants.js';

const SEED_DOCTORS_COUNT = 500;
const SEED_PATIENTS_COUNT = 10000;

// Curated realistic doctors for top results and demo clarity
const CURATED_DOCTORS = [
  { name: 'Dr. Sarah Jenkins', specialization: 'Cardiology', hospital: 'St. Jude Metropolitan Hospital', phone: '+1-555-0101', email: 'sarah.jenkins@hospital.org' },
  { name: 'Dr. Marcus Vance', specialization: 'Neurology', hospital: 'Central General Hospital', phone: '+1-555-0102', email: 'marcus.vance@hospital.org' },
  { name: 'Dr. Elena Rostova', specialization: 'Pediatrics', hospital: 'Children Health Pavilion', phone: '+1-555-0103', email: 'elena.rostova@hospital.org' },
  { name: 'Dr. Arthur Pendelton', specialization: 'Orthopedics', hospital: 'St. Jude Metropolitan Hospital', phone: '+1-555-0104', email: 'arthur.p@hospital.org' },
  { name: 'Dr. Maya Lin', specialization: 'Dermatology', hospital: 'City Skin & Laser Clinic', phone: '+1-555-0105', email: 'maya.lin@clinic.org' },
  { name: 'Dr. Tariq Al-Mansoor', specialization: 'General Medicine', hospital: 'Apollo Health Complex', phone: '+1-555-0106', email: 'tariq.m@apollo.org' },
  { name: 'Dr. Chloe Bennett', specialization: 'Oncology', hospital: 'National Cancer Institute', phone: '+1-555-0107', email: 'chloe.bennett@nci.org' },
  { name: 'Dr. David Kim', specialization: 'Gastroenterology', hospital: 'Central General Hospital', phone: '+1-555-0108', email: 'david.kim@hospital.org' },
  { name: 'Dr. Fatima Zahra', specialization: 'Obstetrics & Gynecology', hospital: 'Maternity & Women Care Center', phone: '+1-555-0109', email: 'fatima.zahra@women.org' },
  { name: 'Dr. Julian Thorne', specialization: 'Psychiatry', hospital: 'Riverside Behavioral Health', phone: '+1-555-0110', email: 'julian.thorne@riverside.org' },
];

const HOSPITALS = [
  'St. Jude Metropolitan Hospital',
  'Central General Hospital',
  'Children Health Pavilion',
  'Apollo Health Complex',
  'National Cancer Institute',
  'City Skin & Laser Clinic',
  'Riverside Behavioral Health',
  'Maternity & Women Care Center',
  'Oakridge Medical Center',
  'Westside Community Hospital',
];

// Helper to generate dates with 180-day spread and mild upward trend
function getRandomDateInLast180Days(): Date {
  const now = Date.now();
  // Bias slightly toward recent dates using square root of random
  const fraction = 1 - Math.sqrt(Math.random());
  const dayOffset = fraction * 180;
  return new Date(now - dayOffset * 24 * 60 * 60 * 1000);
}

async function seed() {
  await connectDB();
  logger.info('🌱 Starting database seed...');

  const shouldReset = process.argv.includes('--reset') || true;
  if (shouldReset) {
    logger.info('Dropping existing collections for clean seed...');
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
    await Doctor.deleteMany({});
    await Patient.deleteMany({});
  }

  // 1. Seed Admin User
  logger.info(`Creating admin user: ${env.SEED_ADMIN_EMAIL}...`);
  const passwordHash = await argon2.hash(env.SEED_ADMIN_PASSWORD);
  await User.create({
    name: 'Hospital Administrator',
    email: env.SEED_ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
  });

  // 2. Seed 500 Doctors
  logger.info(`Generating ${SEED_DOCTORS_COUNT} doctors...`);
  const doctorsData = [];

  // Add curated first
  for (const doc of CURATED_DOCTORS) {
    doctorsData.push({
      _id: new mongoose.Types.ObjectId(),
      name: doc.name,
      nameLower: doc.name.toLowerCase(),
      specialization: doc.specialization,
      hospital: doc.hospital,
      phone: doc.phone.replace(/\s+/g, ''),
      email: doc.email.toLowerCase(),
      patientCount: 0,
      createdAt: getRandomDateInLast180Days(),
      updatedAt: new Date(),
    });
  }

  const usedEmails = new Set(CURATED_DOCTORS.map((d) => d.email.toLowerCase()));

  for (let i = CURATED_DOCTORS.length; i < SEED_DOCTORS_COUNT; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `Dr. ${firstName} ${lastName}`;
    let email = faker.internet.email({ firstName, lastName }).toLowerCase();
    while (usedEmails.has(email)) {
      email = faker.internet.email({ firstName: `${firstName}${i}`, lastName }).toLowerCase();
    }
    usedEmails.add(email);

    // Weighted specializations (General Medicine, Pediatrics higher)
    const spec =
      Math.random() < 0.25
        ? 'General Medicine'
        : Math.random() < 0.2
        ? 'Pediatrics'
        : faker.helpers.arrayElement(SPECIALIZATIONS);

    const hospital = faker.helpers.arrayElement(HOSPITALS);
    const phone = faker.phone.number({ style: 'national' }).replace(/\s+/g, '');

    doctorsData.push({
      _id: new mongoose.Types.ObjectId(),
      name: fullName,
      nameLower: fullName.toLowerCase(),
      specialization: spec,
      hospital,
      phone,
      email,
      patientCount: 0,
      createdAt: getRandomDateInLast180Days(),
      updatedAt: new Date(),
    });
  }

  // Insert doctors
  await Doctor.insertMany(doctorsData);
  logger.info(`✅ Inserted ${doctorsData.length} doctors.`);

  // 3. Seed 10,000 Patients with Skewed Doctor Distribution
  logger.info(`Generating ${SEED_PATIENTS_COUNT} patients with realistic workload distribution...`);

  // Assign doctor weights: first 15 doctors get high load (50–120 patients each), others get fewer
  const doctorIds = doctorsData.map((d) => d._id);
  const patientCountMap = new Map<string, number>();
  for (const id of doctorIds) {
    patientCountMap.set(id.toString(), 0);
  }

  const patientsData = [];
  const topTierCount = 20;

  for (let i = 0; i < SEED_PATIENTS_COUNT; i++) {
    // 60% of patients go to top 20 doctors (creating strong workload contrast for charts)
    let chosenDocId: mongoose.Types.ObjectId;
    if (Math.random() < 0.6) {
      const topIdx = Math.floor(Math.random() * topTierCount);
      chosenDocId = doctorIds[topIdx];
    } else {
      const randomIdx = Math.floor(Math.random() * doctorIds.length);
      chosenDocId = doctorIds[randomIdx];
    }

    patientCountMap.set(chosenDocId.toString(), (patientCountMap.get(chosenDocId.toString()) || 0) + 1);

    const gender = faker.helpers.arrayElement(GENDERS);
    const firstName = gender === 'female' ? faker.person.firstName('female') : faker.person.firstName('male');
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    const condition = faker.helpers.arrayElement(CONDITIONS);
    const status = faker.helpers.arrayElement(PATIENT_STATUSES);
    const createdAt = getRandomDateInLast180Days();

    patientsData.push({
      doctorId: chosenDocId,
      name: fullName,
      nameLower: fullName.toLowerCase(),
      age: faker.number.int({ min: 1, max: 92 }),
      gender,
      phone: faker.phone.number({ style: 'national' }).replace(/\s+/g, ''),
      email: Math.random() < 0.7 ? faker.internet.email({ firstName, lastName }).toLowerCase() : undefined,
      condition,
      status,
      notes: Math.random() < 0.3 ? faker.lorem.sentence() : undefined,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Insert patients in batches of 2000
  const BATCH_SIZE = 2000;
  for (let i = 0; i < patientsData.length; i += BATCH_SIZE) {
    const chunk = patientsData.slice(i, i + BATCH_SIZE);
    await Patient.insertMany(chunk);
    logger.info(`Inserted patients batch ${i + chunk.length} / ${patientsData.length}`);
  }

  // 4. Update Doctor patientCount from actual generated distribution
  logger.info('Updating doctor patient counts...');
  const bulkOps = [];
  for (const [docId, count] of patientCountMap.entries()) {
    bulkOps.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(docId) },
        update: { $set: { patientCount: count } },
      },
    });
  }
  await Doctor.bulkWrite(bulkOps);

  // 5. Sync Indexes
  logger.info('Syncing indexes across all collections...');
  await Promise.all([
    User.syncIndexes(),
    RefreshToken.syncIndexes(),
    Doctor.syncIndexes(),
    Patient.syncIndexes(),
  ]);

  logger.info('🎉 Seed completed successfully!');
  logger.info(`Summary:`);
  logger.info(`- Admin: ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD}`);
  logger.info(`- Doctors: ${doctorsData.length}`);
  logger.info(`- Patients: ${patientsData.length}`);

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
