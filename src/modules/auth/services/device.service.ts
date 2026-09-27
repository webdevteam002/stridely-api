import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Device } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type UpsertDeviceInput = {
  userId: string;
  deviceId: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
  pushToken?: string | null;
  trusted?: boolean;
};

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async registerOrTouch(input: UpsertDeviceInput): Promise<Device> {
    const existing = await this.prisma.device.findFirst({
      where: {
        userId: input.userId,
        deviceId: input.deviceId,
        deletedAt: null,
      },
    });

    if (existing) {
      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          deviceName: input.deviceName ?? existing.deviceName,
          platform: input.platform ?? existing.platform,
          appVersion: input.appVersion ?? existing.appVersion,
          pushToken:
            input.pushToken === undefined
              ? existing.pushToken
              : input.pushToken,
          lastSeen: new Date(),
          trusted: input.trusted ?? existing.trusted,
        },
      });
    }

    // Soft-deleted row for same pair → revive
    const softDeleted = await this.prisma.device.findFirst({
      where: { userId: input.userId, deviceId: input.deviceId },
    });
    if (softDeleted) {
      return this.prisma.device.update({
        where: { id: softDeleted.id },
        data: {
          deletedAt: null,
          deviceName: input.deviceName,
          platform: input.platform,
          appVersion: input.appVersion,
          pushToken: input.pushToken ?? null,
          lastSeen: new Date(),
          trusted: input.trusted ?? false,
        },
      });
    }

    try {
      return await this.prisma.device.create({
        data: {
          userId: input.userId,
          deviceId: input.deviceId,
          deviceName: input.deviceName,
          platform: input.platform,
          appVersion: input.appVersion,
          pushToken: input.pushToken ?? null,
          trusted: input.trusted ?? false,
          lastSeen: new Date(),
        },
      });
    } catch {
      throw new ConflictException({
        code: 'DUPLICATE_DEVICE',
        message: 'Device is already registered',
      });
    }
  }

  async listForUser(userId: string): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { userId, deletedAt: null },
      orderBy: { lastSeen: 'desc' },
    });
  }

  async trustDevice(userId: string, deviceRowId: string): Promise<Device> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceRowId, userId, deletedAt: null },
    });
    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      });
    }
    return this.prisma.device.update({
      where: { id: device.id },
      data: { trusted: true, lastSeen: new Date() },
    });
  }

  async revokeDevice(userId: string, deviceRowId: string): Promise<Device> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceRowId, userId, deletedAt: null },
    });
    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      });
    }
    return this.prisma.device.update({
      where: { id: device.id },
      data: { deletedAt: new Date(), trusted: false },
    });
  }

  toPublic(device: Device) {
    return {
      id: device.id,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      appVersion: device.appVersion,
      lastSeen: device.lastSeen.toISOString(),
      pushToken: device.pushToken,
      trusted: device.trusted,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    };
  }
}
