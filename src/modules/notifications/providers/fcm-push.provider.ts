import { Injectable } from '@nestjs/common';
import {
  PushMessage,
  PushProvider,
  PushSendResult,
} from './push-provider.interface';

/**
 * Extension point for Firebase Cloud Messaging.
 * Not wired by default — inject when FCM credentials are configured.
 */
@Injectable()
export class FcmPushProvider implements PushProvider {
  readonly name = 'fcm';

  async send(_message: PushMessage): Promise<PushSendResult> {
    return {
      ok: false,
      code: 'PROVIDER_UNAVAILABLE',
      message:
        'FCM provider stub — configure firebase-admin and replace MockPushProvider',
      retryable: true,
    };
  }
}
