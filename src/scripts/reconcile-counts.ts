import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { Doctor } from '../modules/doctors/doctor.model.js';
import { Patient } from '../modules/patients/patient.model.js';

async function reconcile() {
  await connectDB();
  logger.info('🔄 Running counter reconciliation between doctors and patients...');

  const aggregation = await Patient.aggregate([
    { $group: { _id: '$doctorId', count: { $sum: 1 } } },
  ]);

  const activeDocIds: mongoose.Types.ObjectId[] = [];
  const bulkOps = [];

  for (const item of aggregation) {
    activeDocIds.push(item._id);
    bulkOps.push({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { patientCount: item.count } },
      },
    });
  }

  if (bulkOps.length > 0) {
    await Doctor.bulkWrite(bulkOps);
  }

  // Set patientCount: 0 for doctors without any patients
  const zeroResult = await Doctor.updateMany(
    { _id: { $nin: activeDocIds } },
    { $set: { patientCount: 0 } }
  );

  logger.info(`✅ Reconciled ${bulkOps.length} doctors with patients; zeroed ${zeroResult.modifiedCount} doctors with 0 patients.`);
  await disconnectDB();
  process.exit(0);
}

reconcile().catch((err) => {
  logger.error({ err }, 'Reconciliation failed');
  process.exit(1);
});
