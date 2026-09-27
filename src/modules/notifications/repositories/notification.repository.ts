import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type CreateNotificationInput = {
  userId: string;
  deviceRowId?: string | null;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  priority?: string;
  scheduledAt?: Date | null;
  status?: string;
};

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateNotificationInput): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        deviceRowId: input.deviceRowId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        priority: input.priority ?? 'normal',
        status: input.status ?? 'pending',
        scheduledAt: input.scheduledAt ?? null,
      },
    });
  }

  findByIdForUser(
    userId: string,
    id: string,
  ): Promise<Notification | null> {
    return this.prisma.notification.findFirst({
      where: { id, userId },
    });
  }

  listForUser(
    userId: string,
    opts?: { limit?: number; status?: string },
  ): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(opts?.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts?.limit ?? 50, 200),
    });
  }

  updateStatus(
    id: string,
    data: Prisma.NotificationUpdateInput,
  ): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data,
    });
  }

  markAllRead(userId: string): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        status: { in: ['sent', 'queued', 'pending'] },
        readAt: null,
      },
      data: { status: 'read', readAt: new Date() },
    });
  }
}
