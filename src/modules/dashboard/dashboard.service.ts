import mongoose from 'mongoose';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';
import { env } from '../../config/env.js';

// Simple in-memory cache with 60s TTL
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

export function invalidateDashboardCache(): void {
  cache.clear();
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached(key: string, data: any): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export class DashboardService {
  static async getSummary(rangeStr = '30d') {
    const cacheKey = `summary_${rangeStr}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const days = rangeStr === '7d' ? 7 : rangeStr === '90d' ? 90 : 30;
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);

    const [totalDoctors, totalPatients, currentPeriodPatients, previousPeriodPatients] =
      await Promise.all([
        Doctor.estimatedDocumentCount(),
        Patient.estimatedDocumentCount(),
        Patient.countDocuments({ createdAt: { $gte: periodStart } }),
        Patient.countDocuments({ createdAt: { $gte: previousPeriodStart, $lt: periodStart } }),
      ]);

    const avgPatientsPerDoctor =
      totalDoctors > 0 ? Number((totalPatients / totalDoctors).toFixed(1)) : 0;

    const deltaPatients = currentPeriodPatients - previousPeriodPatients;
    const deltaPercentage =
      previousPeriodPatients > 0
        ? Number(((deltaPatients / previousPeriodPatients) * 100).toFixed(1))
        : 0;

    const result = {
      totalDoctors,
      totalPatients,
      avgPatientsPerDoctor,
      currentPeriodPatients,
      previousPeriodPatients,
      deltaPatients,
      deltaPercentage,
      rangeDays: days,
    };

    setCached(cacheKey, result);
    return result;
  }

  static async getPatientsPerDoctor(limit = 10) {
    const cacheKey = `patients_per_doc_${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const topDoctors = await Doctor.find({}, { name: 1, specialization: 1, hospital: 1, patientCount: 1 })
      .sort({ patientCount: -1, _id: 1 })
      .limit(limit)
      .lean();

    const result = topDoctors.map((doc) => ({
      id: doc._id,
      name: doc.name,
      specialization: doc.specialization,
      hospital: doc.hospital,
      patientCount: doc.patientCount,
    }));

    setCached(cacheKey, result);
    return result;
  }

  static async getRegistrations(rangeStr = '30d') {
    const cacheKey = `registrations_${rangeStr}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const days = rangeStr === '7d' ? 7 : rangeStr === '90d' ? 90 : 30;
    const now = new Date();
    const startDate = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    const aggregation = await Patient.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: env.APP_TIMEZONE,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const countMap = new Map<string, number>();
    for (const item of aggregation) {
      countMap.set(item._id, item.count);
    }

    // Zero-fill every day in the range
    const series: { date: string; count: number }[] = [];
    const curr = new Date(startDate);
    for (let i = 0; i < days; i++) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, '0');
      const day = String(curr.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      series.push({
        date: dateKey,
        count: countMap.get(dateKey) || 0,
      });

      curr.setDate(curr.getDate() + 1);
    }

    setCached(cacheKey, series);
    return series;
  }

  static async getConditions() {
    const cacheKey = 'conditions_breakdown';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const aggregation = await Patient.aggregate([
      { $group: { _id: '$condition', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const result = aggregation.map((item) => ({
      condition: item._id,
      count: item.count,
    }));

    setCached(cacheKey, result);
    return result;
  }

  static async getSpecializations() {
    const cacheKey = 'specializations_breakdown';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const aggregation = await Doctor.aggregate([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const result = aggregation.map((item) => ({
      specialization: item._id,
      count: item.count,
    }));

    setCached(cacheKey, result);
    return result;
  }
}
