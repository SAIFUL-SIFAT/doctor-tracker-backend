import { Request, Response } from 'express';
import { DoctorsService } from './doctors.service.js';

export class DoctorsController {
  static async list(req: Request, res: Response) {
    const { doctors, meta } = await DoctorsService.listDoctors(req.query);
    res.status(200).json({ data: doctors, meta });
  }

  static async getById(req: Request, res: Response) {
    const doctor = await DoctorsService.getDoctorById(req.params.id);
    res.status(200).json({ data: doctor });
  }

  static async create(req: Request, res: Response) {
    const doctor = await DoctorsService.createDoctor(req.body);
    res.status(201).json({ data: doctor });
  }

  static async getFilters(req: Request, res: Response) {
    const filters = await DoctorsService.getFilterMeta();
    res.status(200).json({ data: filters });
  }

  static async getDoctorPatients(req: Request, res: Response) {
    const { patients, meta } = await DoctorsService.getDoctorPatients(req.params.id, req.query);
    res.status(200).json({ data: patients, meta });
  }

  static async addDoctorPatient(req: Request, res: Response) {
    const patient = await DoctorsService.addPatientToDoctor(req.params.id, req.body);
    res.status(201).json({ data: patient });
  }

  static async removeDoctorPatient(req: Request, res: Response) {
    await DoctorsService.removePatientFromDoctor(req.params.id, req.params.patientId);
    res.status(200).json({ data: { message: 'Patient removed successfully' } });
  }
}
