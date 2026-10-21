export const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General Medicine',
  'Neurology',
  'Obstetrics & Gynecology',
  'Oncology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Urology',
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];

export const CONDITIONS = [
  'Hypertension',
  'Diabetes',
  'Asthma',
  'Arthritis',
  'Migraine',
  'Anxiety',
  'Fracture',
  'Skin Allergy',
  'Gastritis',
  'Thyroid Disorder',
  'Heart Disease',
  'Other',
] as const;

export type Condition = (typeof CONDITIONS)[number];

export const PATIENT_STATUSES = ['active', 'follow_up', 'discharged'] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export const ROLES = ['admin'] as const;
export type Role = (typeof ROLES)[number];
