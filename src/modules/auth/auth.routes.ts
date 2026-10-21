import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema } from './auth.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts, please try again in 15 minutes',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(AuthController.login)
);

authRouter.post('/refresh', asyncHandler(AuthController.refresh));
authRouter.post('/logout', asyncHandler(AuthController.logout));
authRouter.get('/me', requireAuth, asyncHandler(AuthController.me));
