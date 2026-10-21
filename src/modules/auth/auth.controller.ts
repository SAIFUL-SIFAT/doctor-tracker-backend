import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { env } from '../../config/env.js';
import { User } from './user.model.js';
import { ApiError } from '../../utils/ApiError.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
};

export class AuthController {
  static async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'];
    const ip = req.ip || req.socket.remoteAddress;

    const { user, tokens } = await AuthService.login(email, password, userAgent, ip);

    // Set cookies
    res.cookie('dt_access', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('dt_refresh', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    res.status(200).json({
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  }

  static async refresh(req: Request, res: Response) {
    const rawRefreshToken = req.cookies?.dt_refresh;
    const userAgent = req.headers['user-agent'];
    const ip = req.ip || req.socket.remoteAddress;

    const { user, tokens } = await AuthService.refresh(rawRefreshToken, userAgent, ip);

    res.cookie('dt_access', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('dt_refresh', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    res.status(200).json({
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  }

  static async logout(req: Request, res: Response) {
    const rawRefreshToken = req.cookies?.dt_refresh;
    await AuthService.logout(rawRefreshToken);

    res.clearCookie('dt_access');
    res.clearCookie('dt_refresh', { path: '/api/v1/auth' });

    res.status(200).json({
      data: {
        message: 'Successfully logged out',
      },
    });
  }

  static async me(req: Request, res: Response) {
    if (!req.user) {
      throw ApiError.unauthenticated();
    }

    const user = await User.findById(req.user.sub);
    if (!user) {
      throw ApiError.unauthenticated('User not found');
    }

    res.status(200).json({
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  }
}
