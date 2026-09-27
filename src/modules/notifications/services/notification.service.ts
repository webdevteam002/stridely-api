import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NOTIFICATION_TYPES,
} from '../notification.constants';
import { NotificationRepository } from '../repositories/notification.repository';
import { DeviceRegistrationService } from './device-registration.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { NotificationPreferenceService } from './notification-preference.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly repo: NotificationRepository,
    private readonly devices: DeviceRegistrationService,
    private readonly prefs: NotificationPreferenceService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async create(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    priority?: string;
    scheduledAt?: string | null;
    deviceId?: string | null;
    dispatch?: boolean;
  }) {
    if (!NOTIFICATION_TYPES.includes(params.type as (typeof NOTIFICATION_TYPES)[number])) {
      throw new BadRequestException({
        code: 'INVALID_NOTIFICATION_TYPE',
        message: `Unsupported type. Allowed: ${NOTIFICATION_TYPES.join(', ')}`,
      });
    }

    let deviceRowId: string | null = null;
    if (params.deviceId) {
      const device = await this.devices.requireOwnedDevice(
        params.userId,
        params.deviceId,
      );
      deviceRowId = device.id;
    }

    const scheduledAt = params.scheduledAt
      ? new Date(params.scheduledAt)
      : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'scheduledAt must be ISO-8601',
      });
    }

    const created = await this.repo.create({
      userId: params.userId,
      deviceRowId,
      type: params.type,
      title: params.title,
      body: params.body,
      payload: params.payload,
      priority: params.priority ?? 'normal',
      scheduledAt,
      status: 'pending',
    });

    this.logger.log({
      msg: 'Notification created',
      notificationId: created.id,
      type: created.type,
    });

    if (params.dispatch !== false && !scheduledAt) {
      return this.dispatcher.dispatch(params.userId, created.id);
    }

    return {
      notification: this.dispatcher.toPublic(created),
      deliveries: [],
    };
  }

  async list(userId: string, status?: string) {
    const rows = await this.repo.listForUser(userId, { status });
    return rows.map((r) => this.dispatcher.toPublic(r));
  }

  async get(userId: string, id: string) {
    const row = await this.repo.findByIdForUser(userId, id);
    if (!row) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }
    return this.dispatcher.toPublic(row);
  }

  async dispatch(userId: string, id: string) {
    return this.dispatcher.dispatch(userId, id);
  }

  async markAllRead(userId: string) {
    const result = await this.repo.markAllRead(userId);
    return { updated: result.count };
  }

  getPreferences(userId: string, deviceId: string) {
    return this.prefs.getForDevice(userId, deviceId);
  }

  updatePreferences(
    userId: string,
    deviceId: string,
    patch: Record<string, boolean>,
  ) {
    return this.prefs.updateForDevice(userId, deviceId, patch);
  }
}
