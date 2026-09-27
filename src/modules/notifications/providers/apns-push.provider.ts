import { Injectable } from '@nestjs/common';
import {
  PushMessage,
  PushProvider,
  PushSendResult,
} from './push-provider.interface';

/**
 * Extension point for Apple Push Notification service.
 * Not wired by default — inject when APNs credentials are configured.
 */
@Injectable()
export class ApnsPushProvider implements PushProvider {
  readonly name = 'apns';

  async send(_message: PushMessage): Promise<PushSendResult> {
    return {
      ok: false,
      code: 'PROVIDER_UNAVAILABLE',
      message:
        'APNs provider stub — configure APNs key and replace MockPushProvider',
      retryable: true,
    };
  }
}
