import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Device, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizePreferences,
  NotificationPreferenceFlags,
} from '../notification.constants';

export type RegisterDeviceInput = {
  userId: string;
  deviceId: string;
  platform?: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
  pushToken?: string | null;
  notificationPreferences?: Partial<NotificationPreferenceFlags>;
  trusted?: boolean;
  deviceName?: string;
};

@Injectable()
export class DeviceRegistrationService {
  private readonly logger = new Logger(DeviceRegistrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterDeviceInput): Promise<Device> {
    const prefs = normalizePreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(input.notificationPreferences ?? {}),
    });

    const existing = await this.prisma.device.findFirst({
      where: {
        userId: input.userId,
        deviceId: input.deviceId,
        deletedAt: null,
      },
    });

    if (existing) {
      // Duplicate registration → upsert (idempotent), not error
      const updated = await this.prisma.device.update({
        where: { id: existing.id },
        data: {
          platform: input.platform ?? existing.platform,
          appVersion: input.appVersion ?? existing.appVersion,
          locale: input.locale ?? existing.locale,
          timezone: input.timezone ?? existing.timezone,
          pushToken:
            input.pushToken === undefined
              ? existing.pushToken
              : input.pushToken,
          notificationPreferences: prefs as unknown as Prisma.InputJsonValue,
          deviceName: input.deviceName ?? existing.deviceName,
          trusted: input.trusted ?? existing.trusted,
          lastSeen: new Date(),
          version: existing.version + 1,
        },
      });
      this.logger.log({
        msg: 'Registration',
        event: 'device_updated',
        userId: input.userId,
        deviceId: input.deviceId,
      });
      return updated;
    }

    const softDeleted = await this.prisma.device.findFirst({
      where: { userId: input.userId, deviceId: input.deviceId },
    });
    if (softDeleted) {
      const revived = await this.prisma.device.update({
        where: { id: softDeleted.id },
        data: {
          deletedAt: null,
          platform: input.platform,
          appVersion: input.appVersion,
          locale: input.locale ?? 'en-US',
          timezone: input.timezone ?? 'UTC',
          pushToken: input.pushToken ?? null,
          notificationPreferences: prefs as unknown as Prisma.InputJsonValue,
          deviceName: input.deviceName,
          trusted: input.trusted ?? false,
          lastSeen: new Date(),
        },
      });
      this.logger.log({
        msg: 'Registration',
        event: 'device_revived',
        userId: input.userId,
        deviceId: input.deviceId,
      });
      return revived;
    }

    try {
      const created = await this.prisma.device.create({
        data: {
          userId: input.userId,
          deviceId: input.deviceId,
          platform: input.platform,
          appVersion: input.appVersion,
          locale: input.locale ?? 'en-US',
          timezone: input.timezone ?? 'UTC',
          pushToken: input.pushToken ?? null,
          notificationPreferences: prefs as unknown as Prisma.InputJsonValue,
          deviceName: input.deviceName,
          trusted: input.trusted ?? false,
          lastSeen: new Date(),
        },
      });
      this.logger.log({
        msg: 'Registration',
        event: 'device_created',
        userId: input.userId,
        deviceId: input.deviceId,
      });
      return created;
    } catch {
      throw new ConflictException({
        code: 'DUPLICATE_DEVICE',
        message: 'Device is already registered',
      });
    }
  }

  async requireOwnedDevice(
    userId: string,
    clientDeviceId: string,
  ): Promise<Device> {
    const device = await this.prisma.device.findFirst({
      where: {
        userId,
        deviceId: clientDeviceId,
        deletedAt: null,
      },
    });
    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found or not owned by user',
      });
    }
    return device;
  }

  async listForUser(userId: string): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { userId, deletedAt: null },
      orderBy: { lastSeen: 'desc' },
    });
  }

  async clearPushToken(userId: string, clientDeviceId: string): Promise<Device> {
    const device = await this.requireOwnedDevice(userId, clientDeviceId);
    return this.prisma.device.update({
      where: { id: device.id },
      data: { pushToken: null, lastSeen: new Date() },
    });
  }

  toPublic(device: Device) {
    return {
      id: device.id,
      deviceId: device.deviceId,
      platform: device.platform,
      appVersion: device.appVersion,
      locale: device.locale,
      timezone: device.timezone,
      pushToken: device.pushToken,
      notificationPreferences: normalizePreferences(
        device.notificationPreferences,
      ),
      lastSeen: device.lastSeen.toISOString(),
      trusted: device.trusted,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    };
  }
}
