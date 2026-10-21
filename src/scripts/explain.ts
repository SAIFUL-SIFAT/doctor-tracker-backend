import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { Doctor } from '../modules/doctors/doctor.model.js';
import { Patient } from '../modules/patients/patient.model.js';

async function runExplain() {
  await connectDB();
  logger.info('📊 Running query explain analysis on indexed queries...');

  // 1. Doctors default list
  const q1: any = await Doctor.find().sort({ createdAt: -1, _id: -1 }).limit(20).explain('executionStats');
  const stage1 = q1.executionStats.executionStages.stage;
  logger.info(`Query 1 (Doctors default list): stage=${stage1}, docsExamined=${q1.executionStats.totalDocsExamined}, nReturned=${q1.executionStats.nReturned}`);

  // 2. Doctors specialization filter
  const q2: any = await Doctor.find({ specialization: 'Cardiology' }).sort({ createdAt: -1, _id: -1 }).limit(20).explain('executionStats');
  const stage2 = q2.executionStats.executionStages.stage;
  logger.info(`Query 2 (Doctors specialization filter): stage=${stage2}, docsExamined=${q2.executionStats.totalDocsExamined}, nReturned=${q2.executionStats.nReturned}`);

  // 3. Doctors prefix search
  const q3: any = await Doctor.find({ nameLower: { $regex: '^dr. sa' } }).limit(20).explain('executionStats');
  const stage3 = q3.executionStats.executionStages.stage;
  logger.info(`Query 3 (Doctors prefix search): stage=${stage3}, docsExamined=${q3.executionStats.totalDocsExamined}, nReturned=${q3.executionStats.nReturned}`);

  // 4. Patients of doctor X
  const sampleDoc = await Doctor.findOne();
  if (sampleDoc) {
    const q4: any = await Patient.find({ doctorId: sampleDoc._id }).sort({ createdAt: -1, _id: -1 }).limit(20).explain('executionStats');
    const stage4 = q4.executionStats.executionStages.stage;
    logger.info(`Query 4 (Doctor scoped patients): stage=${stage4}, docsExamined=${q4.executionStats.totalDocsExamined}, nReturned=${q4.executionStats.nReturned}`);
  }

  // 5. Patients condition filter + sort
  const q5: any = await Patient.find({ condition: 'Hypertension' }).sort({ createdAt: -1, _id: -1 }).limit(20).explain('executionStats');
  const stage5 = q5.executionStats.executionStages.stage;
  logger.info(`Query 5 (Patients condition filter): stage=${stage5}, docsExamined=${q5.executionStats.totalDocsExamined}, nReturned=${q5.executionStats.nReturned}`);

  // 6. Top doctors by workload
  const q6: any = await Doctor.find({}, { name: 1, patientCount: 1 }).sort({ patientCount: -1, _id: 1 }).limit(10).explain('executionStats');
  const stage6 = q6.executionStats.executionStages.stage;
  logger.info(`Query 6 (Top doctors load): stage=${stage6}, docsExamined=${q6.executionStats.totalDocsExamined}, nReturned=${q6.executionStats.nReturned}`);

  await disconnectDB();
  process.exit(0);
}

runExplain().catch((err) => {
  logger.error({ err }, 'Explain failed');
  process.exit(1);
});
