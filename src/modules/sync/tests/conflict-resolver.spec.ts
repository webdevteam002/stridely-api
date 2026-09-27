import { MergeEngine } from '../services/merge.engine';
import { ConflictResolverService } from '../services/conflict-resolver.service';

describe('ConflictResolverService (multi-device)', () => {
  const merge = new MergeEngine();
  const resolver = new ConflictResolverService(merge);

  const server = (
    version: number,
    payload: Record<string, unknown>,
    updatedAt: string,
    extra?: { deletedAt?: Date | null; deviceId?: string },
  ) => ({
    version,
    payload,
    updatedAt: new Date(updatedAt),
    deletedAt: extra?.deletedAt ?? null,
    deviceId: extra?.deviceId ?? null,
  });

  it('applies create when no existing record', () => {
    const out = resolver.evaluate(
      {
        entityType: 'goal',
        entityId: 'g1',
        operation: 'create',
        clientVersion: 1,
        payload: { targetValue: 8000 },
      },
      null,
    );
    expect(out.status).toBe('applied');
  });

  it('treats equal version as duplicate (idempotent replay)', () => {
    const out = resolver.evaluate(
      {
        entityType: 'goal',
        entityId: 'g1',
        operation: 'update',
        clientVersion: 2,
        payload: { targetValue: 8000 },
      },
      server(2, { targetValue: 8000 }, '2026-07-15T00:00:00.000Z'),
    );
    expect(out.status).toBe('duplicate');
  });

  it('preferences default to last_write_wins', () => {
    expect(resolver.strategyFor('preference')).toBe('last_write_wins');
    expect(resolver.strategyFor('preferences')).toBe('last_write_wins');
  });

  it('achievements default to union', () => {
    expect(resolver.strategyFor('achievement')).toBe('union');
  });

  it('movement sessions default to merge', () => {
    expect(resolver.strategyFor('movement_session')).toBe('merge');
  });

  it('client_wins override applies older client version', () => {
    const out = resolver.evaluate(
      {
        entityType: 'preference',
        entityId: 'p1',
        operation: 'update',
        clientVersion: 1,
        payload: { themeMode: 'dark' },
        conflictStrategy: 'client_wins',
      },
      server(3, { themeMode: 'light' }, '2026-07-15T00:00:00.000Z'),
    );
    expect(out.status).toBe('applied');
    if (out.status === 'applied') {
      expect(out.payload.themeMode).toBe('dark');
    }
  });

  it('LWW prefers newer client timestamp', () => {
    const out = resolver.evaluate(
      {
        entityType: 'goal',
        entityId: 'g1',
        operation: 'update',
        clientVersion: 1,
        payload: { targetValue: 100 },
        clientUpdatedAt: '2026-07-16T00:00:00.000Z',
      },
      server(5, { targetValue: 50 }, '2026-07-14T00:00:00.000Z'),
    );
    expect(out.status).toBe('applied');
    if (out.status === 'applied') {
      expect(out.payload.targetValue).toBe(100);
    }
  });

  it('LWW keeps server when server timestamp is newer (duplicate)', () => {
    const out = resolver.evaluate(
      {
        entityType: 'goal',
        entityId: 'g1',
        operation: 'update',
        clientVersion: 1,
        payload: { targetValue: 100 },
        clientUpdatedAt: '2026-07-10T00:00:00.000Z',
      },
      server(5, { targetValue: 50 }, '2026-07-14T00:00:00.000Z'),
    );
    expect(out.status).toBe('duplicate');
  });

  it('update vs delete: newer delete wins', () => {
    const out = resolver.evaluate(
      {
        entityType: 'goal',
        entityId: 'g1',
        operation: 'delete',
        clientVersion: 2,
        payload: {},
        clientUpdatedAt: '2026-07-16T00:00:00.000Z',
      },
      server(5, { targetValue: 50 }, '2026-07-14T00:00:00.000Z'),
    );
    expect(out.status).toBe('applied');
  });

  it('delete vs delete is idempotent', () => {
    const out = resolver.evaluate(
      {
        entityType: 'goal',
        entityId: 'g1',
        operation: 'delete',
        clientVersion: 3,
        payload: {},
      },
      server(2, {}, '2026-07-14T00:00:00.000Z', {
        deletedAt: new Date('2026-07-14T00:00:00.000Z'),
      }),
    );
    expect(out.status).toBe('duplicate');
  });

  it('create vs create merges achievements (union)', () => {
    const out = resolver.evaluate(
      {
        entityType: 'achievement',
        entityId: 'a1',
        operation: 'create',
        clientVersion: 1,
        payload: { status: 'unlocked', badges: ['b1'], progress: 40 },
      },
      server(1, { status: 'locked', badges: ['b2'], progress: 80 }, '2026-07-14T00:00:00.000Z'),
    );
    expect(out.status).toBe('applied');
    if (out.status === 'applied') {
      expect(out.payload.status).toBe('unlocked');
      expect(out.payload.progress).toBe(80);
      expect(out.payload.badges).toEqual(expect.arrayContaining(['b1', 'b2']));
      expect(out.merged).toBe(true);
    }
  });

  it('merge sessions takes max steps without duplicating entity', () => {
    const out = resolver.evaluate(
      {
        entityType: 'movement_session',
        entityId: 's1',
        operation: 'update',
        clientVersion: 2,
        payload: { steps: 500, sessionId: 's1' },
        clientUpdatedAt: '2026-07-10T00:00:00.000Z',
      },
      server(5, { steps: 300, sessionId: 's1' }, '2026-07-14T00:00:00.000Z'),
    );
    expect(out.status).toBe('applied');
    if (out.status === 'applied') {
      expect(out.payload.steps).toBe(500);
      expect(out.payload.sessionId).toBe('s1');
    }
  });

  it('timestamp tie breaks deterministically by deviceId', () => {
    const ts = '2026-07-15T12:00:00.000Z';
    const a = resolver.evaluate(
      {
        entityType: 'goal',
        entityId: 'g1',
        operation: 'update',
        clientVersion: 1,
        payload: { targetValue: 1 },
        clientUpdatedAt: ts,
        deviceId: 'device-z',
      },
      server(3, { targetValue: 9 }, ts, { deviceId: 'device-a' }),
    );
    expect(a.status).toBe('applied');
    if (a.status === 'applied') {
      expect(a.payload.targetValue).toBe(1); // device-z > device-a
    }
  });
});

describe('MergeEngine', () => {
  const engine = new MergeEngine();

  it('union does not duplicate list entries', () => {
    const out = engine.unionMerge(
      { badges: ['a', 'b'] },
      { badges: ['b', 'c'] },
    );
    expect(out.badges).toEqual(['a', 'b', 'c']);
  });

  it('field merge takes numeric maxima', () => {
    const out = engine.fieldMerge(
      'daily_activity',
      { steps: 100, note: 's' },
      { steps: 250, note: 'c' },
    );
    expect(out.steps).toBe(250);
    expect(out.note).toBe('c');
  });
});
