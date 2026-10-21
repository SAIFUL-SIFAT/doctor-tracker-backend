import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { User, IUser } from './user.model.js';
import { RefreshToken } from './refreshToken.model.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import mongoose from 'mongoose';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static generateAccessToken(user: IUser): string {
    return jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.ACCESS_TOKEN_TTL as any }
    );
  }

  static async createSession(
    user: IUser,
    userAgent?: string,
    ip?: string,
    familyId?: string
  ): Promise<TokenPair> {
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const famId = familyId || crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      familyId: famId,
      expiresAt,
      userAgent,
      ip,
    });

    const accessToken = this.generateAccessToken(user);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  static async login(
    email: string,
    passwordPlain: string,
    userAgent?: string,
    ip?: string
  ): Promise<{ user: IUser; tokens: TokenPair }> {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw ApiError.unauthenticated('Invalid email or password');
    }

    const isValid = await argon2.verify(user.passwordHash, passwordPlain);
    if (!isValid) {
      throw ApiError.unauthenticated('Invalid email or password');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await this.createSession(user, userAgent, ip);
    return { user, tokens };
  }

  static async refresh(
    rawRefreshToken: string,
    userAgent?: string,
    ip?: string
  ): Promise<{ user: IUser; tokens: TokenPair }> {
    if (!rawRefreshToken) {
      throw ApiError.unauthenticated('Missing refresh token');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const existingToken = await RefreshToken.findOne({ tokenHash });

    if (!existingToken) {
      throw ApiError.unauthenticated('Invalid refresh token');
    }

    // Reuse detection: If token was already revoked, someone is replaying a used token
    if (existingToken.revokedAt) {
      // Invalidate the entire token family
      await RefreshToken.updateMany(
        { familyId: existingToken.familyId },
        { revokedAt: new Date() }
      );
      throw ApiError.unauthenticated('Token reuse detected. Session terminated.');
    }

    // If expired
    if (new Date() > existingToken.expiresAt) {
      existingToken.revokedAt = new Date();
      await existingToken.save();
      throw ApiError.unauthenticated('Refresh token expired');
    }

    const user = await User.findById(existingToken.userId);
    if (!user) {
      throw ApiError.unauthenticated('User no longer exists');
    }

    // Rotate token
    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = this.hashToken(newRawRefreshToken);

    existingToken.revokedAt = new Date();
    existingToken.replacedByHash = newTokenHash;
    await existingToken.save();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: newTokenHash,
      familyId: existingToken.familyId,
      expiresAt,
      userAgent,
      ip,
    });

    const accessToken = this.generateAccessToken(user);

    return {
      user,
      tokens: {
        accessToken,
        refreshToken: newRawRefreshToken,
      },
    };
  }

  static async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashToken(rawRefreshToken);
    const token = await RefreshToken.findOne({ tokenHash });
    if (token) {
      token.revokedAt = new Date();
      await token.save();
    }
  }
}
