import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  normalizePreferences,
  NotificationPreferenceFlags,
  preferenceKeyForType,
} from '../notification.constants';
import { DeviceRegistrationService } from './device-registration.service';

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DeviceRegistrationService,
  ) {}

  async getForDevice(userId: string, clientDeviceId: string) {
    const device = await this.devices.requireOwnedDevice(userId, clientDeviceId);
    return {
      deviceId: device.deviceId,
      preferences: normalizePreferences(device.notificationPreferences),
    };
  }

  async updateForDevice(
    userId: string,
    clientDeviceId: string,
    patch: Partial<NotificationPreferenceFlags>,
  ) {
    const device = await this.devices.requireOwnedDevice(userId, clientDeviceId);
    const next = normalizePreferences({
      ...normalizePreferences(device.notificationPreferences),
      ...patch,
    });
    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        notificationPreferences: next as unknown as Prisma.InputJsonValue,
        lastSeen: new Date(),
      },
    });
    this.logger.log({
      msg: 'Notification preferences updated',
      userId,
      deviceId: clientDeviceId,
    });
    return {
      deviceId: updated.deviceId,
      preferences: normalizePreferences(updated.notificationPreferences),
    };
  }

  isAllowed(prefs: NotificationPreferenceFlags, type: string): boolean {
    const key = preferenceKeyForType(type);
    if (!key) return true;
    return prefs[key] !== false;
  }
}
