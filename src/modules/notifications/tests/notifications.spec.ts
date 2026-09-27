import { Test, TestingModule } from '@nestjs/testing';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../database/prisma.service';
import { PUSH_PROVIDER } from '../providers/push-provider.interface';
import { MockPushProvider } from '../providers/mock-push.provider';
import { NotificationRepository } from '../repositories/notification.repository';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { NotificationDispatcher } from '../services/notification-dispatcher.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { NotificationService } from '../services/notification.service';

type Row = Record<string, unknown>;

function createPrisma() {
  const devices = new Map<string, Row>();
  const notifications = new Map<string, Row>();

  const deviceKey = (userId: string, deviceId: string) =>
    `${userId}|${deviceId}`;

  return {
    device: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => {
        for (const d of devices.values()) {
          if (where.id && d.id !== where.id) continue;
          if (where.userId && d.userId !== where.userId) continue;
          if (where.deviceId && d.deviceId !== where.deviceId) continue;
          if (where.deletedAt === null && d.deletedAt) continue;
          return d;
        }
        return null;
      }),
      findMany: jest.fn(async ({ where }: { where: Row }) => {
        return [...devices.values()].filter((d) => {
          if (where.userId && d.userId !== where.userId) return false;
          if (where.deletedAt === null && d.deletedAt) return false;
          if (where.pushToken && (where.pushToken as Row).not === null) {
            if (!d.pushToken) return false;
          }
          return true;
        });
      }),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = {
          id: uuidv4(),
          ...data,
          notificationPreferences: data.notificationPreferences ?? {},
          version: 1,
          trusted: data.trusted ?? false,
          lastSeen: data.lastSeen ?? new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };
        devices.set(deviceKey(row.userId as string, row.deviceId as string), row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        let found: Row | undefined;
        for (const [k, d] of devices) {
          if (d.id === where.id) {
            found = { ...d, ...data, updatedAt: new Date() };
            devices.set(k, found);
            break;
          }
        }
        return found!;
      }),
    },
    notification: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = {
          id: uuidv4(),
          ...data,
          payload: data.payload ?? {},
          priority: data.priority ?? 'normal',
          status: data.status ?? 'pending',
          retryCount: 0,
          sentAt: null,
          readAt: null,
          failureReason: null,
          nextRetryAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        notifications.set(row.id as string, row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: { where: Row }) => {
        for (const n of notifications.values()) {
          if (where.id && n.id !== where.id) continue;
          if (where.userId && n.userId !== where.userId) continue;
          return n;
        }
        return null;
      }),
      findMany: jest.fn(async ({ where }: { where: Row }) => {
        return [...notifications.values()]
          .filter((n) => n.userId === where.userId)
          .sort(
            (a, b) =>
              (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
          );
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const existing = notifications.get(where.id as string)!;
        const row = { ...existing, ...data, updatedAt: new Date() };
        notifications.set(where.id as string, row);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const [id, n] of notifications) {
          if (n.userId !== where.userId) continue;
          notifications.set(id, { ...n, ...data, updatedAt: new Date() });
          count++;
        }
        return { count };
      }),
    },
    _store: { devices, notifications },
  };
}

describe('Notifications platform', () => {
  let module: TestingModule;
  let registration: DeviceRegistrationService;
  let notifications: NotificationService;
  let prisma: ReturnType<typeof createPrisma>;
  const userId = uuidv4();
  const deviceId = uuidv4();

  beforeEach(async () => {
    prisma = createPrisma();
    module = await Test.createTestingModule({
      providers: [
        DeviceRegistrationService,
        NotificationPreferenceService,
        NotificationRepository,
        NotificationDispatcher,
        NotificationService,
        MockPushProvider,
        { provide: PUSH_PROVIDER, useExisting: MockPushProvider },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    registration = module.get(DeviceRegistrationService);
    notifications = module.get(NotificationService);
  });

  it('registers a device with prefs / token / locale', async () => {
    const device = await registration.register({
      userId,
      deviceId,
      platform: 'android',
      appVersion: '1.0.0',
      locale: 'en-US',
      timezone: 'UTC',
      pushToken: 'token-abc',
      notificationPreferences: { goals: true, achievements: false },
    });
    expect(device.pushToken).toBe('token-abc');
    expect(device.locale).toBe('en-US');
    const pub = registration.toPublic(device);
    expect(pub.notificationPreferences.achievements).toBe(false);
    expect(pub.notificationPreferences.goals).toBe(true);
  });

  it('duplicate registration is idempotent upsert', async () => {
    await registration.register({
      userId,
      deviceId,
      pushToken: 't1',
      platform: 'android',
    });
    const second = await registration.register({
      userId,
      deviceId,
      pushToken: 't2',
      platform: 'android',
      appVersion: '1.1.0',
    });
    expect(second.pushToken).toBe('t2');
    expect(second.appVersion).toBe('1.1.0');
    expect(prisma._store.devices.size).toBe(1);
  });

  it('updates notification preferences with ownership check', async () => {
    await registration.register({ userId, deviceId, pushToken: 't1' });
    const updated = await notifications.updatePreferences(userId, deviceId, {
      weeklySummary: false,
    });
    expect(updated.preferences.weeklySummary).toBe(false);
  });

  it('creates and dispatches a notification via mock provider', async () => {
    await registration.register({
      userId,
      deviceId,
      pushToken: 'good-token',
      platform: 'android',
    });
    const result = await notifications.create({
      userId,
      type: 'daily_goal_completed',
      title: 'Goal complete',
      body: 'You hit 10k steps',
      deviceId,
      dispatch: true,
    });
    expect(result.notification.status).toBe('sent');
    expect(result.deliveries[0].status).toBe('sent');
  });

  it('respects preference flags (goals disabled → cancelled)', async () => {
    await registration.register({
      userId,
      deviceId,
      pushToken: 'good-token',
      notificationPreferences: { goals: false },
    });
    const result = await notifications.create({
      userId,
      type: 'goal_milestone',
      title: 'Milestone',
      body: '50%',
      deviceId,
    });
    expect(result.notification.status).toBe('cancelled');
  });

  it('handles invalid token as delivery failure', async () => {
    await registration.register({
      userId,
      deviceId,
      pushToken: 'invalid-xyz',
    });
    const result = await notifications.create({
      userId,
      type: 'achievement_unlocked',
      title: 'Badge',
      body: 'Unlocked',
      deviceId,
    });
    expect(result.notification.status).toBe('failed');
    expect(result.deliveries[0].code).toBe('INVALID_TOKEN');
  });

  it('schedules retry on provider unavailable', async () => {
    await registration.register({
      userId,
      deviceId,
      pushToken: 'unavailable',
    });
    const result = await notifications.create({
      userId,
      type: 'sync_failure',
      title: 'Sync failed',
      body: 'Retry later',
      deviceId,
    });
    expect(result.notification.status).toBe('failed');
    expect(result.notification.retryCount).toBe(1);
    expect(result.notification.nextRetryAt).toBeTruthy();
  });

  it('permission denied token fails without retry', async () => {
    await registration.register({
      userId,
      deviceId,
      pushToken: 'deny-token',
    });
    const result = await notifications.create({
      userId,
      type: 'weekly_summary_ready',
      title: 'Weekly',
      body: 'Ready',
      deviceId,
    });
    expect(result.notification.status).toBe('failed');
    expect(result.deliveries[0].code).toBe('PERMISSION_DENIED');
    expect(result.notification.nextRetryAt).toBeNull();
  });
});
