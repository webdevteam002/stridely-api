import { Injectable, Logger } from '@nestjs/common';
import {
  PushMessage,
  PushProvider,
  PushSendResult,
} from './push-provider.interface';

/**
 * Deterministic mock provider for local/dev/tests.
 * Token conventions:
 * - starts with `invalid` → INVALID_TOKEN
 * - starts with `expired` → EXPIRED_TOKEN
 * - starts with `deny` → PERMISSION_DENIED
 * - equals `unavailable` → PROVIDER_UNAVAILABLE
 * - otherwise success
 */
@Injectable()
export class MockPushProvider implements PushProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPushProvider.name);

  async send(message: PushMessage): Promise<PushSendResult> {
    const token = message.token ?? '';
    if (token.startsWith('invalid')) {
      return {
        ok: false,
        code: 'INVALID_TOKEN',
        message: 'Push token is invalid',
        retryable: false,
      };
    }
    if (token.startsWith('expired')) {
      return {
        ok: false,
        code: 'EXPIRED_TOKEN',
        message: 'Push token expired',
        retryable: false,
      };
    }
    if (token.startsWith('deny')) {
      return {
        ok: false,
        code: 'PERMISSION_DENIED',
        message: 'Notification permission denied on device',
        retryable: false,
      };
    }
    if (token === 'unavailable') {
      return {
        ok: false,
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Push provider unavailable',
        retryable: true,
      };
    }

    const providerMessageId = `mock_${message.notificationId}_${Date.now()}`;
    this.logger.log({
      msg: 'Notification sent',
      provider: this.name,
      notificationId: message.notificationId,
      type: message.type,
      providerMessageId,
    });
    return { ok: true, providerMessageId };
  }
}
