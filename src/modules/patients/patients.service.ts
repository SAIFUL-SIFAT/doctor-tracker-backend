import mongoose, { FilterQuery } from 'mongoose';
import { Patient, IPatient } from './patient.model.js';
import { Doctor } from '../doctors/doctor.model.js';
import { escapeRegex } from '../../utils/escapeRegex.js';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../../utils/pagination.js';
import { ApiError } from '../../utils/ApiError.js';
import { UpdatePatientInput } from './patients.schema.js';

export class PatientsService {
  static async listPatients(query: any): Promise<{ patients: any[]; meta: PaginationMeta }> {
    const { page, limit, skip } = parsePagination(query);
    const filter: FilterQuery<IPatient> = {};

    if (query.doctorId) {
      if (!mongoose.Types.ObjectId.isValid(query.doctorId)) {
        throw ApiError.badRequest('Invalid doctor ID');
      }
      filter.doctorId = new mongoose.Types.ObjectId(query.doctorId);
    }

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
      Patient.find(filter)
        .populate('doctorId', 'name specialization hospital email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Patient.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(page, limit, total);
    return { patients, meta };
  }

  static async getPatientById(id: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid patient ID');
    }
    const patient = await Patient.findById(id)
      .populate('doctorId', 'name specialization hospital email')
      .lean();
    if (!patient) {
      throw ApiError.notFound('Patient not found');
    }
    return patient;
  }

  static async updatePatient(id: string, updateData: UpdatePatientInput): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid patient ID');
    }

    const patient = await Patient.findById(id);
    if (!patient) {
      throw ApiError.notFound('Patient not found');
    }

    // Check if re-assigning doctor
    const isReassigning =
      updateData.doctorId &&
      updateData.doctorId.toString() !== patient.doctorId.toString();

    if (isReassigning) {
      const newDoctor = await Doctor.findById(updateData.doctorId);
      if (!newDoctor) {
        throw ApiError.notFound('Target doctor does not exist');
      }

      const session = await mongoose.startSession();
      try {
        let updated: any;
        await session.withTransaction(async () => {
          const oldDoctorId = patient.doctorId;
          const newDoctorId = updateData.doctorId;

          Object.assign(patient, updateData);
          updated = await patient.save({ session });

          await Doctor.findByIdAndUpdate(
            oldDoctorId,
            { $inc: { patientCount: -1 } },
            { session }
          );
          await Doctor.findByIdAndUpdate(
            newDoctorId,
            { $inc: { patientCount: 1 } },
            { session }
          );
        });
        return updated;
      } finally {
        await session.endSession();
      }
    } else {
      Object.assign(patient, updateData);
      await patient.save();
      return patient;
    }
  }

  static async deletePatient(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid patient ID');
    }

    const patient = await Patient.findById(id);
    if (!patient) {
      throw ApiError.notFound('Patient not found');
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const doctorId = patient.doctorId;
        await Patient.deleteOne({ _id: id }, { session });
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
