import mongoose, { Schema, Document } from 'mongoose';
import { CONDITIONS, Condition, GENDERS, Gender, PATIENT_STATUSES, PatientStatus } from '../../config/constants.js';

export interface IPatient extends Document {
  doctorId: mongoose.Types.ObjectId;
  name: string;
  nameLower: string;
  age: number;
  gender: Gender;
  phone: string;
  email?: string;
  condition: Condition;
  status: PatientStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    nameLower: { type: String, required: true },
    age: { type: Number, required: true, min: 0, max: 120, validate: Number.isInteger },
    gender: { type: String, enum: GENDERS, required: true },
    phone: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    condition: { type: String, enum: CONDITIONS, required: true },
    status: { type: String, enum: PATIENT_STATUSES, default: 'active', required: true },
    notes: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

patientSchema.pre('validate', function () {
  if (this.name) {
    this.nameLower = this.name.toLowerCase();
  }
  if (this.phone) {
    this.phone = this.phone.replace(/\s+/g, '');
  }
});

// Indexes per SCHEMA.md §5.3
patientSchema.index({ doctorId: 1, createdAt: -1, _id: -1 });
patientSchema.index({ createdAt: -1, _id: -1 });
patientSchema.index({ condition: 1, createdAt: -1 });
patientSchema.index({ status: 1, createdAt: -1 });
patientSchema.index({ doctorId: 1, condition: 1, createdAt: -1 });
patientSchema.index({ nameLower: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index(
  {
    name: 'text',
    email: 'text',
  },
  {
    weights: {
      name: 10,
      email: 2,
    },
    name: 'patient_text_index',
  }
);

export const Patient = mongoose.model<IPatient>('Patient', patientSchema);
