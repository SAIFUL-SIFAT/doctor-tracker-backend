import mongoose, { Schema, Document } from 'mongoose';
import { SPECIALIZATIONS, Specialization } from '../../config/constants.js';

export interface IDoctor extends Document {
  name: string;
  nameLower: string;
  specialization: Specialization;
  hospital: string;
  phone: string;
  email: string;
  patientCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    nameLower: { type: String, required: true },
    specialization: { type: String, enum: SPECIALIZATIONS, required: true },
    hospital: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    phone: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
    patientCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

doctorSchema.pre('validate', function () {
  if (this.name) {
    this.nameLower = this.name.toLowerCase();
  }
  if (this.phone) {
    this.phone = this.phone.replace(/\s+/g, '');
  }
});


doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ createdAt: -1, _id: -1 });
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });
doctorSchema.index({ patientCount: -1, _id: 1 });
doctorSchema.index({ nameLower: 1 });
doctorSchema.index(
  {
    name: 'text',
    specialization: 'text',
    hospital: 'text',
    email: 'text',
  },
  {
    weights: {
      name: 10,
      specialization: 5,
      hospital: 3,
      email: 2,
    },
    name: 'doctor_text_index',
  }
);

export const Doctor = mongoose.model<IDoctor>('Doctor', doctorSchema);
