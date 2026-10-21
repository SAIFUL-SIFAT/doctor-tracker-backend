import { Router } from 'express';
import { DashboardController } from './dashboard.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/summary', asyncHandler(DashboardController.summary));
dashboardRouter.get('/patients-per-doctor', asyncHandler(DashboardController.patientsPerDoctor));
dashboardRouter.get('/registrations', asyncHandler(DashboardController.registrations));
dashboardRouter.get('/conditions', asyncHandler(DashboardController.conditions));
dashboardRouter.get('/specializations', asyncHandler(DashboardController.specializations));
