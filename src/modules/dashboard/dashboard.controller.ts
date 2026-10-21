import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service.js';

export class DashboardController {
  static async summary(req: Request, res: Response) {
    const range = String(req.query.range || '30d');
    const data = await DashboardService.getSummary(range);
    res.status(200).json({ data });
  }

  static async patientsPerDoctor(req: Request, res: Response) {
    const limit = parseInt(String(req.query.limit || '10'), 10) || 10;
    const data = await DashboardService.getPatientsPerDoctor(limit);
    res.status(200).json({ data });
  }

  static async registrations(req: Request, res: Response) {
    const range = String(req.query.range || '30d');
    const data = await DashboardService.getRegistrations(range);
    res.status(200).json({ data });
  }

  static async conditions(req: Request, res: Response) {
    const data = await DashboardService.getConditions();
    res.status(200).json({ data });
  }

  static async specializations(req: Request, res: Response) {
    const data = await DashboardService.getSpecializations();
    res.status(200).json({ data });
  }
}
