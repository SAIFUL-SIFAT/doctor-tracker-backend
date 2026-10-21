import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id;

  // Custom ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  // Zod Validation Error
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details,
        requestId,
      },
    });
    return;
  }

  // Mongo duplicate key error (code 11000)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    const field = fields[0] || 'field';
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: `${field} already exists`,
        details: [{ field, message: `${field} must be unique` }],
        requestId,
      },
    });
    return;
  }

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid format for field '${err.path}'`,
        details: [{ field: err.path, message: `Invalid ObjectId format` }],
        requestId,
      },
    });
    return;
  }

  // Mongoose ValidationError
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((item: any) => ({
      field: item.path,
      message: item.message,
    }));
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
        requestId,
      },
    });
    return;
  }

  // Fallback 500
  logger.error({ err, requestId }, 'Unhandled error in request');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected server error occurred' : err.message || 'Internal Server Error',
      requestId,
    },
  });
}
