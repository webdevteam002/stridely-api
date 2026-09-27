import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../database/prisma.service';
import { DeviceService } from './device.service';
import { GoogleAuthService } from './google-auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { TokenPair, TokenService } from './token.service';

export type DeviceContext = {
  deviceId: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
  pushToken?: string | null;
};

export type AuthResult = {
  user: ReturnType<AuthService['toPublicUser']>;
  device: ReturnType<DeviceService['toPublic']>;
  tokens: TokenPair;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly devices: DeviceService,
    private readonly sessions: SessionService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  async register(
    input: {
      email: string;
      password: string;
      displayName?: string;
    },
    device: DeviceContext,
    meta?: { ip?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_ACCOUNT',
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName,
        accountType: 'email',
      },
    });

    return this.completeLogin(user, device, 'register', meta);
  }

  async login(
    input: { email: string; password: string },
    device: DeviceContext,
    meta?: { ip?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user?.passwordHash) {
      await this.sessions.audit({
        event: 'login_failed',
        success: false,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        requestId: meta?.requestId,
        metadata: { reason: 'unknown_user' },
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const ok = await this.passwords.verify(user.passwordHash, input.password);
    if (!ok) {
      await this.sessions.audit({
        userId: user.id,
        event: 'login_failed',
        success: false,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        requestId: meta?.requestId,
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    return this.completeLogin(user, device, 'login', meta);
  }

  /** Sign in or register via Google ID token (verified server-side). */
  async googleSignIn(
    input: { idToken: string; displayName?: string },
    device: DeviceContext,
    meta?: { ip?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthResult> {
    const profile = await this.googleAuth.verifyIdToken(input.idToken);
    const email = profile.email;

    let user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          displayName:
            input.displayName?.trim() ||
            profile.name?.trim() ||
            email.split('@')[0],
          accountType: 'oauth_google',
          passwordHash: null,
          emailVerifiedAt: profile.emailVerified ? new Date() : null,
        },
      });
      return this.completeLogin(user, device, 'google_register', meta);
    }

    // Existing account — log in. Upgrade anonymous rows if needed.
    if (user.accountType === 'anonymous') {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email,
          displayName:
            input.displayName?.trim() ||
            profile.name?.trim() ||
            user.displayName,
          accountType: 'oauth_google',
          emailVerifiedAt: profile.emailVerified ? new Date() : null,
          upgradedAt: new Date(),
        },
      });
    } else if (
      user.accountType === 'email' &&
      profile.emailVerified &&
      !user.emailVerifiedAt
    ) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    return this.completeLogin(user, device, 'google_login', meta);
  }

  /** Create or resume an anonymous local cloud shell for offline-first. */
  async anonymousLocal(
    input: { anonymousKey?: string; displayName?: string },
    device: DeviceContext,
    meta?: { ip?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthResult> {
    const anonymousKey = input.anonymousKey ?? uuidv4();
    let user = await this.prisma.user.findFirst({
      where: { anonymousKey, deletedAt: null },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          anonymousKey,
          displayName: input.displayName ?? 'Guest',
          accountType: 'anonymous',
          email: null,
          passwordHash: null,
        },
      });
    }

    return this.completeLogin(user, device, 'anonymous_login', meta);
  }

  /**
   * Upgrade anonymous → email account on the same user row.
   * Merge into an existing email account is prepared (returns conflict + merge hint).
   */
  async upgradeGuest(
    userId: string,
    input: { email: string; password: string; displayName?: string },
    device: DeviceContext,
    meta?: { ip?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthResult & { mergeRequired?: boolean; targetUserId?: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user || user.accountType !== 'anonymous') {
      throw new BadRequestException({
        code: 'NOT_ANONYMOUS',
        message: 'Only anonymous accounts can be upgraded',
      });
    }

    const email = input.email.trim().toLowerCase();
    const conflict = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (conflict) {
      await this.sessions.audit({
        userId,
        event: 'guest_upgrade_merge_required',
        success: false,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        requestId: meta?.requestId,
        metadata: { targetUserId: conflict.id },
      });
      throw new ConflictException({
        code: 'MERGE_REQUIRED',
        message:
          'An account with this email already exists. Client should start account merge.',
        targetUserId: conflict.id,
        anonymousUserId: userId,
      });
    }

    const passwordHash = await this.passwords.hash(input.password);
    const upgraded = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email,
        passwordHash,
        displayName: input.displayName ?? user.displayName,
        accountType: 'email',
        upgradedAt: new Date(),
      },
    });

    return this.completeLogin(upgraded, device, 'guest_upgrade', meta);
  }

  async logout(
    userId: string,
    refreshToken?: string,
    revokeAll = false,
  ): Promise<{ ok: true }> {
    if (revokeAll) {
      await this.tokens.revokeAllUserSessions(userId);
    } else if (refreshToken) {
      await this.tokens.revokeRefreshToken(refreshToken);
    }
    await this.sessions.audit({
      userId,
      event: 'logout',
      success: true,
    });
    return { ok: true };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const rotated = await this.tokens.rotateRefreshToken(refreshToken);
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: rotated.userId },
    });
    const device = await this.prisma.device.update({
      where: { id: rotated.deviceRowId },
      data: { lastSeen: new Date() },
    });

    await this.sessions.audit({
      userId: user.id,
      deviceRowId: device.id,
      event: 'token_refresh',
      success: true,
    });

    return {
      user: this.toPublicUser(user),
      device: this.devices.toPublic(device),
      tokens: {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        accessTokenExpiresAt: rotated.accessTokenExpiresAt,
        refreshTokenExpiresAt: rotated.refreshTokenExpiresAt,
        tokenType: rotated.tokenType,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'User not found',
      });
    }
    return this.toPublicUser(user);
  }

  async listDevices(userId: string) {
    const list = await this.devices.listForUser(userId);
    return list.map((d) => this.devices.toPublic(d));
  }

  async revokeDevice(userId: string, deviceRowId: string) {
    const device = await this.devices.revokeDevice(userId, deviceRowId);
    await this.tokens.revokeDeviceSessions(deviceRowId);
    await this.sessions.audit({
      userId,
      deviceRowId,
      event: 'device_revoked',
      success: true,
    });
    return this.devices.toPublic(device);
  }

  async trustDevice(userId: string, deviceRowId: string) {
    const device = await this.devices.trustDevice(userId, deviceRowId);
    await this.sessions.audit({
      userId,
      deviceRowId,
      event: 'device_trusted',
      success: true,
    });
    return this.devices.toPublic(device);
  }

  toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      accountType: user.accountType,
      anonymousKey: user.anonymousKey,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      upgradedAt: user.upgradedAt?.toISOString() ?? null,
      locale: user.locale,
      timezone: user.timezone,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private async completeLogin(
    user: User,
    deviceCtx: DeviceContext,
    event: string,
    meta?: { ip?: string; userAgent?: string; requestId?: string },
  ): Promise<AuthResult> {
    const device = await this.devices.registerOrTouch({
      userId: user.id,
      deviceId: deviceCtx.deviceId,
      deviceName: deviceCtx.deviceName,
      platform: deviceCtx.platform,
      appVersion: deviceCtx.appVersion,
      pushToken: deviceCtx.pushToken,
    });

    const issued = await this.tokens.issuePair({
      userId: user.id,
      deviceRowId: device.id,
      clientDeviceId: device.deviceId,
      accountType: user.accountType,
    });

    await this.sessions.audit({
      userId: user.id,
      deviceRowId: device.id,
      event,
      success: true,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      requestId: meta?.requestId,
    });

    const { familyId: _familyId, ...tokens } = issued;
    return {
      user: this.toPublicUser(user),
      device: this.devices.toPublic(device),
      tokens,
    };
  }
}
