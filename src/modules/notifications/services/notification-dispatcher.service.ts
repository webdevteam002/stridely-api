import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Device, Notification } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { normalizePreferences } from '../notification.constants';
import {
  PUSH_PROVIDER,
} from '../providers/push-provider.interface';
import type { PushProvider } from '../providers/push-provider.interface';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferenceService } from './notification-preference.service';

const MAX_RETRIES = 5;

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: NotificationRepository,
    private readonly prefs: NotificationPreferenceService,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  async dispatch(userId: string, notificationId: string) {
    const notification = await this.repo.findByIdForUser(userId, notificationId);
    if (!notification) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }

    const targets = await this.resolveTargets(notification);
    if (targets.length === 0) {
      const cancelled = await this.repo.updateStatus(notification.id, {
        status: 'cancelled',
        failureReason: 'No eligible devices (prefs / token)',
      });
      this.logger.warn({
        msg: 'Delivery failure',
        reason: 'no_targets',
        notificationId,
      });
      return { notification: this.toPublic(cancelled), deliveries: [] };
    }

    await this.repo.updateStatus(notification.id, { status: 'queued' });
    this.logger.log({
      msg: 'Notification queued',
      notificationId,
      targets: targets.length,
      provider: this.push.name,
    });

    const deliveries: Array<Record<string, unknown>> = [];
    let anySent = false;
    let lastFailure: string | null = null;
    let retryable = false;

    for (const device of targets) {
      if (!device.pushToken) {
        deliveries.push({
          deviceId: device.deviceId,
          status: 'skipped',
          reason: 'missing_token',
        });
        continue;
      }

      const result = await this.push.send({
        notificationId: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        payload: (notification.payload ?? {}) as Record<string, unknown>,
        priority: (notification.priority as 'low' | 'normal' | 'high') ?? 'normal',
        token: device.pushToken,
        platform: device.platform,
        locale: device.locale,
      });

      if (result.ok) {
        anySent = true;
        deliveries.push({
          deviceId: device.deviceId,
          status: 'sent',
          providerMessageId: result.providerMessageId,
        });
      } else {
        lastFailure = `${result.code}: ${result.message}`;
        retryable = result.retryable;
        deliveries.push({
          deviceId: device.deviceId,
          status: 'failed',
          code: result.code,
          message: result.message,
        });
        this.logger.warn({
          msg: 'Delivery failure',
          notificationId,
          deviceId: device.deviceId,
          code: result.code,
        });

        if (
          result.code === 'INVALID_TOKEN' ||
          result.code === 'EXPIRED_TOKEN'
        ) {
          await this.prisma.device.update({
            where: { id: device.id },
            data: { pushToken: null },
          });
        }
      }
    }

    if (anySent) {
      const sent = await this.repo.updateStatus(notification.id, {
        status: 'sent',
        sentAt: new Date(),
        failureReason: null,
      });
      return { notification: this.toPublic(sent), deliveries };
    }

    const retryCount = notification.retryCount + 1;
    if (retryable && retryCount <= MAX_RETRIES) {
      const nextRetryAt = new Date(
        Date.now() + Math.min(60_000 * 2 ** (retryCount - 1), 3600_000),
      );
      const failed = await this.repo.updateStatus(notification.id, {
        status: 'failed',
        failureReason: lastFailure,
        retryCount,
        nextRetryAt,
      });
      this.logger.log({
        msg: 'Retry scheduled',
        notificationId,
        retryCount,
        nextRetryAt: nextRetryAt.toISOString(),
      });
      return { notification: this.toPublic(failed), deliveries };
    }

    const failed = await this.repo.updateStatus(notification.id, {
      status: 'failed',
      failureReason: lastFailure ?? 'All deliveries failed',
      retryCount,
    });
    return { notification: this.toPublic(failed), deliveries };
  }

  private async resolveTargets(notification: Notification): Promise<Device[]> {
    if (notification.deviceRowId) {
      const device = await this.prisma.device.findFirst({
        where: {
          id: notification.deviceRowId,
          userId: notification.userId,
          deletedAt: null,
        },
      });
      if (!device) return [];
      const prefs = normalizePreferences(device.notificationPreferences);
      if (!this.prefs.isAllowed(prefs, notification.type)) return [];
      return [device];
    }

    const devices = await this.prisma.device.findMany({
      where: {
        userId: notification.userId,
        deletedAt: null,
        pushToken: { not: null },
      },
    });
    return devices.filter((d) =>
      this.prefs.isAllowed(
        normalizePreferences(d.notificationPreferences),
        notification.type,
      ),
    );
  }

  toPublic(n: Notification) {
    return {
      notificationId: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      payload: n.payload,
      priority: n.priority,
      status: n.status,
      createdAt: n.createdAt.toISOString(),
      scheduledAt: n.scheduledAt?.toISOString() ?? null,
      sentAt: n.sentAt?.toISOString() ?? null,
      readAt: n.readAt?.toISOString() ?? null,
      failureReason: n.failureReason,
      retryCount: n.retryCount,
      nextRetryAt: n.nextRetryAt?.toISOString() ?? null,
    };
  }
}
