export const NOTIFICATION_TYPES = [
  'daily_goal_completed',
  'goal_milestone',
  'achievement_unlocked',
  'weekly_summary_ready',
  'sync_failure',
  'sync_success',
  'reminder',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationPreferenceFlags = {
  goals: boolean;
  achievements: boolean;
  reminders: boolean;
  weeklySummary: boolean;
  system: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceFlags = {
  goals: true,
  achievements: true,
  reminders: true,
  weeklySummary: true,
  system: true,
};

/** Map event type → preference category. */
export function preferenceKeyForType(
  type: string,
): keyof NotificationPreferenceFlags | null {
  switch (type) {
    case 'daily_goal_completed':
    case 'goal_milestone':
      return 'goals';
    case 'achievement_unlocked':
      return 'achievements';
    case 'weekly_summary_ready':
      return 'weeklySummary';
    case 'reminder':
      return 'reminders';
    case 'sync_failure':
    case 'sync_success':
      return 'system';
    default:
      return 'system';
  }
}

export function normalizePreferences(
  raw: unknown,
): NotificationPreferenceFlags {
  const base = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  return {
    goals: typeof o.goals === 'boolean' ? o.goals : base.goals,
    achievements:
      typeof o.achievements === 'boolean' ? o.achievements : base.achievements,
    reminders: typeof o.reminders === 'boolean' ? o.reminders : base.reminders,
    weeklySummary:
      typeof o.weeklySummary === 'boolean'
        ? o.weeklySummary
        : base.weeklySummary,
    system: typeof o.system === 'boolean' ? o.system : base.system,
  };
}
