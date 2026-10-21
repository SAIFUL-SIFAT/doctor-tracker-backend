import { Request, Response } from 'express';
import { PatientsService } from './patients.service.js';

export class PatientsController {
  static async list(req: Request, res: Response) {
    const { patients, meta } = await PatientsService.listPatients(req.query);
    res.status(200).json({ data: patients, meta });
  }

  static async getById(req: Request, res: Response) {
    const patient = await PatientsService.getPatientById(req.params.id);
    res.status(200).json({ data: patient });
  }

  static async update(req: Request, res: Response) {
    const patient = await PatientsService.updatePatient(req.params.id, req.body);
    res.status(200).json({ data: patient });
  }

  static async delete(req: Request, res: Response) {
    await PatientsService.deletePatient(req.params.id);
    res.status(200).json({ data: { message: 'Patient deleted successfully' } });
  }
}
