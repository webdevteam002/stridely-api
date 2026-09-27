/** Injection token for the active PushProvider implementation. */
export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export type PushMessage = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high';
  token: string;
  platform?: string | null;
  locale?: string | null;
};

export type PushSendResult =
  | { ok: true; providerMessageId: string }
  | {
      ok: false;
      code:
        | 'INVALID_TOKEN'
        | 'EXPIRED_TOKEN'
        | 'PROVIDER_UNAVAILABLE'
        | 'PERMISSION_DENIED'
        | 'UNKNOWN';
      message: string;
      retryable: boolean;
    };

/**
 * Provider-agnostic push transport.
 * Swap MockPushProvider → FcmPushProvider / ApnsPushProvider without
 * changing NotificationDispatcher business logic.
 */
export interface PushProvider {
  readonly name: string;
  send(message: PushMessage): Promise<PushSendResult>;
}
