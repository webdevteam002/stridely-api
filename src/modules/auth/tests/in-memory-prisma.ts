import { v4 as uuidv4 } from 'uuid';

type Row = Record<string, unknown>;

function now() {
  return new Date();
}

/** Minimal in-memory Prisma stand-in for auth unit/e2e tests. */
export function createInMemoryPrisma() {
  const users = new Map<string, Row>();
  const devices = new Map<string, Row>();
  const refreshTokens = new Map<string, Row>();
  const loginAudits = new Map<string, Row>();

  const findUser = async (where: Row): Promise<Row | null> => {
    for (const u of users.values()) {
      if (where.deletedAt === null && u.deletedAt) continue;
      if (where.id && u.id !== where.id) continue;
      if (where.email && u.email !== where.email) continue;
      if (where.anonymousKey && u.anonymousKey !== where.anonymousKey) continue;
      return u;
    }
    return null;
  };

  return {
    user: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        const id = (data.id as string) ?? uuidv4();
        const row = {
          ...data,
          id,
          locale: data.locale ?? 'en-US',
          timezone: data.timezone ?? 'UTC',
          version: 1,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          emailVerifiedAt: null,
          upgradedAt: null,
          mergedIntoUserId: null,
        };
        users.set(id, row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: { where: Row }) => findUser(where)),
      findFirstOrThrow: jest.fn(async ({ where }: { where: Row }) => {
        const found = await findUser(where);
        if (!found) throw new Error('User not found');
        return found;
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = users.get(where.id as string);
        if (!row) throw new Error('User not found');
        Object.assign(row, data, { updatedAt: now() });
        return row;
      }),
    },
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
      create: jest.fn(async ({ data }: { data: Row }) => {
        const id = uuidv4();
        const row = {
          ...data,
          id,
          version: 1,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          lastSeen: data.lastSeen ?? now(),
          trusted: data.trusted ?? false,
        };
        devices.set(id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = devices.get(where.id as string);
        if (!row) throw new Error('Device not found');
        Object.assign(row, data, { updatedAt: now() });
        return row;
      }),
      findMany: jest.fn(async ({ where }: { where: Row }) => {
        return [...devices.values()]
          .filter((d) => {
            if (where.userId && d.userId !== where.userId) return false;
            if (where.deletedAt === null && d.deletedAt) return false;
            return true;
          })
          .sort(
            (a, b) =>
              (b.lastSeen as Date).getTime() - (a.lastSeen as Date).getTime(),
          );
      }),
    },
    refreshToken: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        const id = uuidv4();
        const row = {
          ...data,
          id,
          revokedAt: null,
          replacedBy: null,
          createdAt: now(),
          updatedAt: now(),
        };
        refreshTokens.set(id, row);
        return row;
      }),
      findUnique: jest.fn(
        async ({
          where,
          include,
        }: {
          where: Row;
          include?: { device?: boolean; user?: boolean };
        }) => {
          let row: Row | undefined;
          for (const t of refreshTokens.values()) {
            if (where.tokenHash && t.tokenHash === where.tokenHash) {
              row = t;
              break;
            }
            if (where.id && t.id === where.id) {
              row = t;
              break;
            }
          }
          if (!row) return null;
          const result: Row = { ...row };
          if (include?.device) {
            result.device = devices.get(row.deviceId as string);
          }
          if (include?.user) {
            result.user = users.get(row.userId as string);
          }
          return result;
        },
      ),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        let row: Row | undefined;
        if (where.id) row = refreshTokens.get(where.id as string);
        if (!row && where.tokenHash) {
          row = [...refreshTokens.values()].find(
            (t) => t.tokenHash === where.tokenHash,
          );
        }
        if (!row) throw new Error('RefreshToken not found');
        Object.assign(row, data, { updatedAt: now() });
        return row;
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: Row; data: Row }) => {
          let count = 0;
          for (const t of refreshTokens.values()) {
            if (where.familyId && t.familyId !== where.familyId) continue;
            if (where.deviceId && t.deviceId !== where.deviceId) continue;
            if (where.userId && t.userId !== where.userId) continue;
            if (where.tokenHash && t.tokenHash !== where.tokenHash) continue;
            if (where.revokedAt === null && t.revokedAt) continue;
            Object.assign(t, data, { updatedAt: now() });
            count += 1;
          }
          return { count };
        },
      ),
    },
    loginAudit: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        const id = uuidv4();
        const row = { ...data, id, createdAt: now() };
        loginAudits.set(id, row);
        return row;
      }),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    ping: jest.fn().mockResolvedValue(true),
    _store: { users, devices, refreshTokens, loginAudits },
  };
}
