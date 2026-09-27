import { Test, TestingModule } from '@nestjs/testing';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../database/prisma.service';
import { BatchConflictProcessor } from '../services/batch-conflict.processor';
import { BatchProcessor } from '../services/batch.processor';
import { ConflictResolverService } from '../services/conflict-resolver.service';
import { MergeEngine } from '../services/merge.engine';
import { SyncAuditService } from '../services/sync-audit.service';
import { SyncProcessor } from '../services/sync.processor';
import { SyncService } from '../services/sync.service';
import { VersionValidator } from '../services/version.validator';

type Row = Record<string, unknown>;

function createSyncPrisma() {
  const records = new Map<string, Row>();
  const cursors = new Map<string, Row>();
  const idem = new Map<string, Row>();
  const jobs: Row[] = [];
  const conflictLogs: Row[] = [];
  const mergeHistories: Row[] = [];
  const historyEvents: Row[] = [];

  const key = (userId: string, entityType: string, entityId: string) =>
    `${userId}|${entityType}|${entityId}`;

  return {
    syncRecord: {
      findUnique: jest.fn(async ({ where }: { where: Row }) => {
        const c = where.userId_entityType_entityId as Row;
        return (
          records.get(
            key(c.userId as string, c.entityType as string, c.entityId as string),
          ) ?? null
        );
      }),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: Row;
          create: Row;
          update: Row;
        }) => {
          const c = where.userId_entityType_entityId as Row;
          const k = key(
            c.userId as string,
            c.entityType as string,
            c.entityId as string,
          );
          const existing = records.get(k);
          const row = existing
            ? {
                ...existing,
                ...update,
                updatedAt: (update.updatedAt as Date) ?? new Date(),
              }
            : {
                id: uuidv4(),
                ...create,
                createdAt: new Date(),
                updatedAt: (create.updatedAt as Date) ?? new Date(),
              };
          records.set(k, row);
          return row;
        },
      ),
      findMany: jest.fn(async ({ where, take }: { where: Row; take?: number }) => {
        let list = [...records.values()].filter((r) => r.userId === where.userId);
        if (where.updatedAt && (where.updatedAt as Row).gt) {
          const gt = (where.updatedAt as Row).gt as Date;
          list = list.filter((r) => (r.updatedAt as Date) > gt);
        }
        list.sort(
          (a, b) =>
            (a.updatedAt as Date).getTime() - (b.updatedAt as Date).getTime(),
        );
        return list.slice(0, take ?? 100);
      }),
      count: jest.fn(async ({ where }: { where: Row }) => {
        return [...records.values()].filter((r) => {
          if (r.userId !== where.userId) return false;
          if (where.deletedAt === null && r.deletedAt) return false;
          return true;
        }).length;
      }),
    },
    syncCursor: {
      findUnique: jest.fn(async ({ where }: { where: Row }) => {
        const c = where.userId_deviceId as Row;
        return cursors.get(`${c.userId}|${c.deviceId}`) ?? null;
      }),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: Row;
          create: Row;
          update: Row;
        }) => {
          const c = where.userId_deviceId as Row;
          const k = `${c.userId}|${c.deviceId}`;
          const existing = cursors.get(k);
          const row = existing
            ? { ...existing, ...update, updatedAt: new Date() }
            : {
                id: uuidv4(),
                ...create,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
          cursors.set(k, row);
          return row;
        },
      ),
    },
    syncIdempotencyKey: {
      findUnique: jest.fn(async ({ where }: { where: Row }) => {
        const c = where.userId_requestId as Row;
        return idem.get(`${c.userId}|${c.requestId}`) ?? null;
      }),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: Row;
          create: Row;
          update: Row;
        }) => {
          const c = where.userId_requestId as Row;
          const k = `${c.userId}|${c.requestId}`;
          const existing = idem.get(k);
          const row = existing
            ? { ...existing, ...update }
            : { id: uuidv4(), ...create };
          idem.set(k, row);
          return row;
        },
      ),
    },
    syncJob: {
      count: jest.fn(async () => jobs.length),
    },
    syncConflictLog: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: uuidv4(), ...data };
        conflictLogs.push(row);
        return row;
      }),
    },
    syncMergeHistory: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: uuidv4(), ...data };
        mergeHistories.push(row);
        return row;
      }),
    },
    syncHistoryEvent: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: uuidv4(), ...data };
        historyEvents.push(row);
        return row;
      }),
    },
    _store: { records, cursors, idem, conflictLogs, mergeHistories, historyEvents },
  };
}

const syncProviders = (prisma: ReturnType<typeof createSyncPrisma>) => [
  SyncService,
  SyncProcessor,
  BatchProcessor,
  BatchConflictProcessor,
  MergeEngine,
  VersionValidator,
  ConflictResolverService,
  SyncAuditService,
  { provide: PrismaService, useValue: prisma },
];

describe('SyncService', () => {
  let service: SyncService;
  let prisma: ReturnType<typeof createSyncPrisma>;
  const userId = uuidv4();
  const deviceId = uuidv4();

  beforeEach(async () => {
    prisma = createSyncPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: syncProviders(prisma),
    }).compile();
    service = module.get(SyncService);
  });

  it('uploads ops and is idempotent on requestId', async () => {
    const ops = [
      {
        entityType: 'goal',
        entityId: 'g1',
        operation: 'create',
        clientVersion: 1,
        payload: { targetValue: 8000 },
      },
    ];
    const first = await service.upload({
      userId,
      deviceId,
      operations: ops,
      requestId: 'req-1',
    });
    expect((first as { applied: unknown[] }).applied.length).toBe(1);

    const second = await service.upload({
      userId,
      deviceId,
      operations: ops,
      requestId: 'req-1',
    });
    expect(second).toEqual(first);
  });

  it('downloads incremental changes', async () => {
    await service.upload({
      userId,
      deviceId,
      operations: [
        {
          entityType: 'goal',
          entityId: 'g1',
          operation: 'create',
          clientVersion: 1,
          payload: { targetValue: 8000 },
        },
      ],
    });
    const dl = await service.download({ userId, deviceId });
    expect(dl.changes.length).toBeGreaterThanOrEqual(1);
  });

  it('writes sync history events on apply', async () => {
    await service.upload({
      userId,
      deviceId,
      operations: [
        {
          entityType: 'goal',
          entityId: 'g2',
          operation: 'create',
          clientVersion: 1,
          payload: { targetValue: 1 },
        },
      ],
    });
    expect(prisma._store.historyEvents.length).toBeGreaterThan(0);
  });
});

describe('Multi-device conflict integration', () => {
  let service: SyncService;
  let prisma: ReturnType<typeof createSyncPrisma>;
  const userId = uuidv4();
  const androidA = uuidv4();
  const androidB = uuidv4();
  const iphone = uuidv4();

  beforeEach(async () => {
    prisma = createSyncPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: syncProviders(prisma),
    }).compile();
    service = module.get(SyncService);
  });

  async function finalGoal(entityId = 'goal-1') {
    const row = prisma._store.records.get(`${userId}|goal|${entityId}`);
    return row?.payload as Record<string, unknown> | undefined;
  }

  it('Android ↔ Android: LWW converges to newest preference', async () => {
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [
        {
          entityType: 'preference',
          entityId: 'prefs',
          operation: 'update',
          clientVersion: 1,
          payload: { themeMode: 'light' },
          clientUpdatedAt: '2026-07-15T10:00:00.000Z',
        },
      ],
    });
    await service.upload({
      userId,
      deviceId: androidB,
      operations: [
        {
          entityType: 'preference',
          entityId: 'prefs',
          operation: 'update',
          clientVersion: 1,
          payload: { themeMode: 'dark' },
          clientUpdatedAt: '2026-07-15T12:00:00.000Z',
        },
      ],
    });
    const row = prisma._store.records.get(`${userId}|preference|prefs`);
    expect((row?.payload as Row).themeMode).toBe('dark');
  });

  it('Android ↔ iPhone: order-independent goal LWW', async () => {
    const opA = {
      entityType: 'goal',
      entityId: 'goal-1',
      operation: 'update' as const,
      clientVersion: 2,
      payload: { targetValue: 7000 },
      clientUpdatedAt: '2026-07-15T08:00:00.000Z',
    };
    const opB = {
      entityType: 'goal',
      entityId: 'goal-1',
      operation: 'update' as const,
      clientVersion: 2,
      payload: { targetValue: 10000 },
      clientUpdatedAt: '2026-07-15T09:00:00.000Z',
    };

    // Order 1: Android then iPhone
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [opA],
      requestId: 'ord-1a',
    });
    await service.upload({
      userId,
      deviceId: iphone,
      operations: [opB],
      requestId: 'ord-1b',
    });
    const first = await finalGoal();

    // Reset and reverse order
    prisma._store.records.clear();
    await service.upload({
      userId,
      deviceId: iphone,
      operations: [opB],
      requestId: 'ord-2a',
    });
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [opA],
      requestId: 'ord-2b',
    });
    const second = await finalGoal();
    expect(first?.targetValue).toBe(10000);
    expect(second?.targetValue).toBe(10000);
  });

  it('Three-device sync: merge sessions then LWW goals', async () => {
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [
        {
          entityType: 'movement_session',
          entityId: 's1',
          operation: 'create',
          clientVersion: 1,
          payload: { steps: 1000, sessionId: 's1' },
        },
      ],
    });
    await service.upload({
      userId,
      deviceId: androidB,
      operations: [
        {
          entityType: 'movement_session',
          entityId: 's1',
          operation: 'update',
          clientVersion: 1,
          payload: { steps: 2500, sessionId: 's1' },
          clientUpdatedAt: '2026-07-14T00:00:00.000Z',
        },
      ],
    });
    await service.upload({
      userId,
      deviceId: iphone,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'create',
          clientVersion: 1,
          payload: { targetValue: 9000 },
        },
      ],
    });
    const session = prisma._store.records.get(`${userId}|movement_session|s1`);
    expect((session?.payload as Row).steps).toBe(2500);
    expect(await finalGoal()).toEqual({ targetValue: 9000 });
  });

  it('Offline edits then sync: higher version wins fast-forward', async () => {
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'create',
          clientVersion: 1,
          payload: { targetValue: 5000 },
        },
      ],
    });
    await service.upload({
      userId,
      deviceId: androidB,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'update',
          clientVersion: 3,
          payload: { targetValue: 12000 },
        },
      ],
    });
    expect((await finalGoal())?.targetValue).toBe(12000);
  });

  it('Offline deletes: delete vs update by timestamp', async () => {
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'create',
          clientVersion: 1,
          payload: { targetValue: 5000 },
        },
      ],
    });
    await service.upload({
      userId,
      deviceId: androidB,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'delete',
          clientVersion: 2,
          payload: {},
          clientUpdatedAt: '2026-07-16T00:00:00.000Z',
        },
      ],
    });
    const row = prisma._store.records.get(`${userId}|goal|goal-1`);
    expect(row?.deletedAt).toBeTruthy();
  });

  it('Duplicate upload ignored via requestId', async () => {
    const ops = [
      {
        entityType: 'goal',
        entityId: 'goal-dup',
        operation: 'create',
        clientVersion: 1,
        payload: { targetValue: 1 },
      },
    ];
    await service.upload({
      userId,
      deviceId: androidA,
      operations: ops,
      requestId: 'dup-1',
    });
    await service.upload({
      userId,
      deviceId: androidA,
      operations: ops,
      requestId: 'dup-1',
    });
    expect(prisma.syncRecord.upsert).toHaveBeenCalledTimes(1);
  });

  it('Replay attack: same version + same payload is duplicate', async () => {
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'create',
          clientVersion: 5,
          payload: { targetValue: 1 },
        },
      ],
    });
    const replay = await service.upload({
      userId,
      deviceId: iphone,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'update',
          clientVersion: 5,
          payload: { targetValue: 1 },
        },
      ],
    });
    expect((replay as { applied: Array<{ status: string }> }).applied[0].status).toBe('duplicate');
    expect((await finalGoal())?.targetValue).toBe(1);
  });

  it('Merge achievements across devices (union)', async () => {
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [
        {
          entityType: 'achievement',
          entityId: 'streak-7',
          operation: 'create',
          clientVersion: 1,
          payload: { status: 'unlocked', badges: ['day1'], progress: 50 },
        },
      ],
    });
    await service.upload({
      userId,
      deviceId: iphone,
      operations: [
        {
          entityType: 'achievement',
          entityId: 'streak-7',
          operation: 'create',
          clientVersion: 1,
          payload: { status: 'locked', badges: ['day2'], progress: 90 },
        },
      ],
    });
    const row = prisma._store.records.get(`${userId}|achievement|streak-7`);
    const payload = row?.payload as Row;
    expect(payload.status).toBe('unlocked');
    expect(payload.progress).toBe(90);
    expect(payload.badges).toEqual(expect.arrayContaining(['day1', 'day2']));
    expect(prisma._store.mergeHistories.length).toBeGreaterThan(0);
  });

  it('Lost device: remaining devices keep authoritative cloud state', async () => {
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'create',
          clientVersion: 1,
          payload: { targetValue: 8000 },
        },
      ],
    });
    // Lost androidA — iphone pulls and continues
    const dl = await service.download({ userId, deviceId: iphone });
    expect(dl.changes.some((c) => c.entityId === 'goal-1')).toBe(true);
    await service.upload({
      userId,
      deviceId: iphone,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'update',
          clientVersion: 2,
          payload: { targetValue: 8500 },
        },
      ],
    });
    expect((await finalGoal())?.targetValue).toBe(8500);
  });

  it('App reinstall: empty cursor download restores cloud records', async () => {
    await service.upload({
      userId,
      deviceId: androidA,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'create',
          clientVersion: 1,
          payload: { targetValue: 8000 },
        },
        {
          entityType: 'preference',
          entityId: 'prefs',
          operation: 'create',
          clientVersion: 1,
          payload: { themeMode: 'dark' },
        },
      ],
    });
    const newDevice = uuidv4();
    const dl = await service.download({ userId, deviceId: newDevice });
    expect(dl.changes.length).toBe(2);
  });

  it('Batch conflicts collapse to single op per entity', async () => {
    const batch = moduleGet(service);
    const result = await batch.upload({
      userId,
      deviceId: androidA,
      operations: [
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'update',
          clientVersion: 1,
          payload: { targetValue: 1 },
          clientUpdatedAt: '2026-07-15T01:00:00.000Z',
        },
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'update',
          clientVersion: 3,
          payload: { targetValue: 3 },
          clientUpdatedAt: '2026-07-15T03:00:00.000Z',
        },
        {
          entityType: 'goal',
          entityId: 'goal-1',
          operation: 'update',
          clientVersion: 2,
          payload: { targetValue: 2 },
          clientUpdatedAt: '2026-07-15T02:00:00.000Z',
        },
      ],
    });
    expect((result as { applied: unknown[] }).applied.length).toBe(1);
    expect((await finalGoal())?.targetValue).toBe(3);
  });
});

function moduleGet(service: SyncService): SyncService {
  return service;
}
