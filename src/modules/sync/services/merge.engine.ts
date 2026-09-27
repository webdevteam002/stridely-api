import { Injectable, Logger } from '@nestjs/common';

export type ConflictStrategy =
  | 'last_write_wins'
  | 'client_wins'
  | 'server_wins'
  | 'merge'
  | 'union';

/**
 * Deterministic entity-aware merge — never duplicates sessions / achievements /
 * goals / history / preferences (entityId is the identity key).
 */
@Injectable()
export class MergeEngine {
  private readonly logger = new Logger(MergeEngine.name);

  merge(
    entityType: string,
    strategy: ConflictStrategy,
    server: Record<string, unknown>,
    client: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized = this.normalizeType(entityType);

    if (strategy === 'union' || normalized === 'achievement') {
      const result = this.unionMerge(server, client);
      this.logger.log({ msg: 'Merge completed', strategy: 'union', entityType });
      return result;
    }

    if (
      strategy === 'merge' ||
      normalized === 'movement_session' ||
      normalized === 'history' ||
      normalized === 'goal_history' ||
      normalized === 'daily_activity' ||
      normalized === 'profile'
    ) {
      const result = this.fieldMerge(normalized, server, client);
      this.logger.log({ msg: 'Merge completed', strategy: 'merge', entityType });
      return result;
    }

    // LWW / client / server handled by resolver — shallow merge fallback
    return { ...server, ...client };
  }

  /** Set-union for list fields; scalar client overwrite for the rest. */
  unionMerge(
    server: Record<string, unknown>,
    client: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...server, ...client };
    for (const key of Object.keys({ ...server, ...client })) {
      const s = server[key];
      const c = client[key];
      if (Array.isArray(s) || Array.isArray(c)) {
        const left = Array.isArray(s) ? s : [];
        const right = Array.isArray(c) ? c : [];
        out[key] = this.uniqueConcat(left, right);
      }
    }
    // Achievements: unlocked wins over locked
    if (typeof out['status'] === 'string' || typeof server['status'] === 'string') {
      out['status'] = this.preferUnlocked(
        String(server['status'] ?? 'locked'),
        String(client['status'] ?? 'locked'),
      );
    }
    if (typeof server['progress'] === 'number' || typeof client['progress'] === 'number') {
      out['progress'] = Math.max(
        Number(server['progress'] ?? 0),
        Number(client['progress'] ?? 0),
      );
    }
    return out;
  }

  fieldMerge(
    entityType: string,
    server: Record<string, unknown>,
    client: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...server, ...client };

    // Numeric maxima for counters (steps, distance, etc.)
    for (const key of [
      'steps',
      'distanceMeters',
      'caloriesKcal',
      'activeMinutes',
      'targetValue',
      'finalValue',
      'walkingDurationMs',
      'runningDurationMs',
    ]) {
      if (key in server || key in client) {
        out[key] = Math.max(
          Number(server[key] ?? 0),
          Number(client[key] ?? 0),
        );
      }
    }

    // Session ids / lists — union without duplicates
    for (const key of ['sessionIds', 'badges', 'unlockedKeys']) {
      if (key in server || key in client) {
        const left = Array.isArray(server[key]) ? (server[key] as unknown[]) : [];
        const right = Array.isArray(client[key]) ? (client[key] as unknown[]) : [];
        out[key] = this.uniqueConcat(left, right);
      }
    }

    // Soft-delete: if either side deleted and newer, keep deletedAt
    if (server['deletedAt'] || client['deletedAt']) {
      out['deletedAt'] = this.laterIso(
        server['deletedAt'] as string | null | undefined,
        client['deletedAt'] as string | null | undefined,
      );
    }

    if (entityType === 'movement_session') {
      // Never invent a second session — entityId is canonical
      out['sessionId'] = client['sessionId'] ?? server['sessionId'];
    }

    return out;
  }

  private uniqueConcat(a: unknown[], b: unknown[]): unknown[] {
    const seen = new Set<string>();
    const out: unknown[] = [];
    for (const item of [...a, ...b]) {
      const key =
        item !== null && typeof item === 'object'
          ? JSON.stringify(item)
          : String(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  private preferUnlocked(a: string, b: string): string {
    const rank = (s: string) =>
      s === 'claimed' ? 3 : s === 'unlocked' ? 2 : 1;
    return rank(a) >= rank(b) ? a : b;
  }

  private laterIso(
    a?: string | null,
    b?: string | null,
  ): string | null {
    if (!a) return b ?? null;
    if (!b) return a;
    return Date.parse(a) >= Date.parse(b) ? a : b;
  }

  normalizeType(entityType: string): string {
    const t = entityType.toLowerCase();
    if (t === 'preferences' || t === 'settings') return 'preference';
    if (t === 'goals') return 'goal';
    if (t === 'achievements') return 'achievement';
    if (t === 'movement_sessions') return 'movement_session';
    if (t === 'daily_activities') return 'daily_activity';
    if (t === 'weekly_summary' || t === 'monthly_summary' || t === 'yearly_summary') {
      return 'history';
    }
    return t;
  }
}
