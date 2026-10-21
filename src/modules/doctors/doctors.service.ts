import mongoose, { FilterQuery } from 'mongoose';
import { Doctor, IDoctor } from './doctor.model.js';
import { Patient } from '../patients/patient.model.js';
import { escapeRegex } from '../../utils/escapeRegex.js';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../../utils/pagination.js';
import { ApiError } from '../../utils/ApiError.js';
import { CreateDoctorInput } from './doctors.schema.js';

export class DoctorsService {
  static async listDoctors(query: any): Promise<{ doctors: IDoctor[]; meta: PaginationMeta }> {
    const { page, limit, skip } = parsePagination(query);
    const filter: FilterQuery<IDoctor> = {};

    // Specialization (can be CSV or array)
    if (query.specialization) {
      const specs = Array.isArray(query.specialization)
        ? query.specialization
        : String(query.specialization).split(',').map((s) => s.trim()).filter(Boolean);
      if (specs.length > 0) {
        filter.specialization = { $in: specs };
      }
    }

    // Hospital
    if (query.hospital) {
      filter.hospital = query.hospital;
    }

    // Date range on createdAt
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) {
        filter.createdAt.$gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    // Search query
    if (query.q) {
      const q = String(query.q).trim();
      const escaped = escapeRegex(q);
      const escapedLower = escapeRegex(q.toLowerCase());

      // Use index on nameLower prefix or text search
      filter.$or = [
        { nameLower: { $regex: '^' + escapedLower } },
        { hospital: { $regex: escaped, $options: 'i' } },
        { specialization: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escapedLower, $options: 'i' } },
      ];
    }

    // Sorting
    let sort: any = { createdAt: -1, _id: -1 };
    if (query.sort) {
      const sortStr = String(query.sort);
      const isDesc = sortStr.startsWith('-');
      const field = isDesc ? sortStr.substring(1) : sortStr;
      sort = { [field]: isDesc ? -1 : 1, _id: -1 };
    }

    const [doctors, total] = await Promise.all([
      Doctor.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Doctor.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(page, limit, total);
    return { doctors: doctors as IDoctor[], meta };
  }

  static async getDoctorById(id: string): Promise<IDoctor> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid doctor ID');
    }
    const doctor = await Doctor.findById(id).lean();
    if (!doctor) {
      throw ApiError.notFound('Doctor not found');
    }
    return doctor as IDoctor;
  }

  static async createDoctor(data: CreateDoctorInput): Promise<IDoctor> {
    const existing = await Doctor.findOne({ email: data.email });
    if (existing) {
      throw ApiError.conflict('A doctor with this email already exists', [
        { field: 'email', message: 'Email already in use' },
      ]);
    }

    const doctor = new Doctor(data);
    await doctor.save();
    return doctor;
  }

  static async getFilterMeta(): Promise<{ specializations: string[]; hospitals: string[] }> {
    const [specializations, hospitals] = await Promise.all([
      Doctor.distinct('specialization'),
      Doctor.distinct('hospital'),
    ]);

    return {
      specializations: specializations.sort(),
      hospitals: hospitals.sort(),
    };
  }

  static async getDoctorPatients(
    doctorId: string,
    query: any
  ): Promise<{ patients: any[]; meta: PaginationMeta }> {
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      throw ApiError.badRequest('Invalid doctor ID');
    }

    // Verify doctor exists
    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) {
      throw ApiError.notFound('Doctor not found');
    }

    const { page, limit, skip } = parsePagination(query);
    const filter: FilterQuery<any> = { doctorId: new mongoose.Types.ObjectId(doctorId) };

    if (query.condition) {
      const conds = Array.isArray(query.condition)
        ? query.condition
        : String(query.condition).split(',').map((c) => c.trim()).filter(Boolean);
      if (conds.length > 0) {
        filter.condition = { $in: conds };
      }
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) {
        filter.createdAt.$gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    if (query.q) {
      const q = String(query.q).trim();
      const escaped = escapeRegex(q);
      const escapedLower = escapeRegex(q.toLowerCase());
      filter.$or = [
        { nameLower: { $regex: '^' + escapedLower } },
        { phone: { $regex: escaped } },
        { email: { $regex: escapedLower, $options: 'i' } },
      ];
    }

    let sort: any = { createdAt: -1, _id: -1 };
    if (query.sort) {
      const sortStr = String(query.sort);
      const isDesc = sortStr.startsWith('-');
      const field = isDesc ? sortStr.substring(1) : sortStr;
      sort = { [field]: isDesc ? -1 : 1, _id: -1 };
    }

    const [patients, total] = await Promise.all([
      Patient.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Patient.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(page, limit, total);
    return { patients, meta };
  }

  static async addPatientToDoctor(
    doctorId: string,
    patientData: any
  ): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      throw ApiError.badRequest('Invalid doctor ID');
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      throw ApiError.notFound('Doctor not found');
    }

    const session = await mongoose.startSession();
    try {
      let createdPatient: any;
      await session.withTransaction(async () => {
        const patient = new Patient({
          ...patientData,
          doctorId: doctor._id,
        });
        createdPatient = await patient.save({ session });

        await Doctor.findByIdAndUpdate(
          doctor._id,
          { $inc: { patientCount: 1 } },
          { session }
        );
      });

      return createdPatient;
    } finally {
      await session.endSession();
    }
  }

  static async removePatientFromDoctor(
    doctorId: string,
    patientId: string
  ): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(doctorId) || !mongoose.Types.ObjectId.isValid(patientId)) {
      throw ApiError.badRequest('Invalid ID format');
    }

    const patient = await Patient.findOne({ _id: patientId, doctorId });
    if (!patient) {
      throw ApiError.notFound('Patient not found under this doctor');
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Patient.deleteOne({ _id: patientId }, { session });
        await Doctor.findByIdAndUpdate(
          doctorId,
          { $inc: { patientCount: -1 } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
  }
}
