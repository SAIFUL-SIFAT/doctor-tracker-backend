import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { doctorsRouter } from './modules/doctors/doctors.routes.js';
import { patientsRouter } from './modules/patients/patients.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

export function createApp(): Express {
  const app = express();

  // Basic security and parsing
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);

  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.id,
      })
    );
  }

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API v1 routes
  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/doctors', doctorsRouter);
  apiV1.use('/patients', patientsRouter);
  apiV1.use('/dashboard', dashboardRouter);

  app.use('/api/v1', apiV1);

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
