import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { User } from '../modules/auth/user.model.js';
import { RefreshToken } from '../modules/auth/refreshToken.model.js';
import { Doctor } from '../modules/doctors/doctor.model.js';
import { Patient } from '../modules/patients/patient.model.js';

async function syncAllIndexes() {
  await connectDB();
  logger.info('Syncing indexes across all collections...');

  try {
    const results = await Promise.allSettled([
      User.syncIndexes(),
      RefreshToken.syncIndexes(),
      Doctor.syncIndexes(),
      Patient.syncIndexes(),
    ]);

    results.forEach((res, index) => {
      const modelNames = ['User', 'RefreshToken', 'Doctor', 'Patient'];
      if (res.status === 'fulfilled') {
        logger.info(`Indexes synced for ${modelNames[index]}`);
      } else {
        logger.error(`Failed to sync indexes for ${modelNames[index]}: ${res.reason}`);
      }
    });

    logger.info('🎉 Index synchronization finished.');
  } catch (error) {
    logger.error({ error }, 'Error syncing indexes');
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

syncAllIndexes();
