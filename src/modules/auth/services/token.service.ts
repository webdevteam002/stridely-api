import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../database/prisma.service';

export type AccessTokenPayload = {
  sub: string;
  deviceId: string;
  deviceRowId: string;
  accountType: string;
  typ: 'access';
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  tokenType: 'Bearer';
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issuePair(params: {
    userId: string;
    deviceRowId: string;
    clientDeviceId: string;
    accountType: string;
    familyId?: string;
  }): Promise<TokenPair & { familyId: string }> {
    const familyId = params.familyId ?? uuidv4();
    const accessTtl = this.config.get<string>('auth.accessTtl', '15m');
    const refreshDays = this.config.get<number>('auth.refreshTtlDays', 30);
    const now = Date.now();
    const accessExpiresMs = this.parseTtlMs(accessTtl);
    const refreshExpiresAt = new Date(now + refreshDays * 24 * 60 * 60 * 1000);

    const accessExpiresSec = Math.floor(accessExpiresMs / 1000);
    const accessToken = await this.jwt.signAsync(
      {
        sub: params.userId,
        deviceId: params.clientDeviceId,
        deviceRowId: params.deviceRowId,
        accountType: params.accountType,
        typ: 'access',
      },
      {
        expiresIn: accessExpiresSec,
        secret: this.config.getOrThrow<string>('auth.jwtSecret'),
        issuer: this.config.get<string>('auth.issuer', 'stridely-api'),
        audience: this.config.get<string>('auth.audience', 'stridely-app'),
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: params.userId,
        deviceId: params.deviceRowId,
        tokenHash,
        familyId,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(now + accessExpiresMs).toISOString(),
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      tokenType: 'Bearer',
      familyId,
    };
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    clockSkewSeconds = 60,
  ): Promise<TokenPair & { userId: string; deviceRowId: string; clientDeviceId: string; accountType: string }> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { device: true, user: true },
    });

    if (!existing) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid',
      });
    }

    if (existing.revokedAt) {
      // Reuse detection — revoke entire family
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        code: 'REVOKED_REFRESH_TOKEN',
        message: 'Refresh token has been revoked',
      });
    }

    const skewMs = clockSkewSeconds * 1000;
    if (existing.expiresAt.getTime() + skewMs < Date.now()) {
      throw new UnauthorizedException({
        code: 'EXPIRED_REFRESH_TOKEN',
        message: 'Refresh token has expired',
      });
    }

    if (existing.user.deletedAt) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Account is unavailable',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const pair = await this.issuePair({
      userId: existing.userId,
      deviceRowId: existing.deviceId,
      clientDeviceId: existing.device.deviceId,
      accountType: existing.user.accountType,
      familyId: existing.familyId,
    });

    await this.prisma.refreshToken.update({
      where: { tokenHash: this.hashToken(pair.refreshToken) },
      data: {},
    });

    // Link rotation chain
    const newHash = this.hashToken(pair.refreshToken);
    const created = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newHash },
    });
    if (created) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { replacedBy: created.id },
      });
    }

    return {
      ...pair,
      userId: existing.userId,
      deviceRowId: existing.deviceId,
      clientDeviceId: existing.device.deviceId,
      accountType: existing.user.accountType,
    };
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeDeviceSessions(deviceRowId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { deviceId: deviceRowId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('auth.jwtSecret'),
        issuer: this.config.get<string>('auth.issuer', 'stridely-api'),
        audience: this.config.get<string>('auth.audience', 'stridely-app'),
        clockTolerance: this.config.get<number>('auth.clockSkewSeconds', 60),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'EXPIRED_OR_INVALID_ACCESS_TOKEN',
        message: 'Access token is expired or invalid',
      });
    }
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 15 * 60 * 1000;
    const n = Number(match[1]);
    switch (match[2]) {
      case 's':
        return n * 1000;
      case 'm':
        return n * 60 * 1000;
      case 'h':
        return n * 60 * 60 * 1000;
      case 'd':
        return n * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }
}
