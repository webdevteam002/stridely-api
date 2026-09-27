import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async audit(params: {
    userId?: string | null;
    deviceRowId?: string | null;
    event: string;
    success?: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.loginAudit.create({
      data: {
        userId: params.userId ?? null,
        deviceId: params.deviceRowId ?? null,
        event: params.event,
        success: params.success ?? true,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        requestId: params.requestId ?? null,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
