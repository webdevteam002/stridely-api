import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  DeviceRegistrationController,
  NotificationController,
} from './controllers/notification.controller';
import { PUSH_PROVIDER } from './providers/push-provider.interface';
import { MockPushProvider } from './providers/mock-push.provider';
import { FcmPushProvider } from './providers/fcm-push.provider';
import { ApnsPushProvider } from './providers/apns-push.provider';
import { NotificationRepository } from './repositories/notification.repository';
import { DeviceRegistrationService } from './services/device-registration.service';
import { NotificationDispatcher } from './services/notification-dispatcher.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationService } from './services/notification.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationController, DeviceRegistrationController],
  providers: [
    NotificationRepository,
    DeviceRegistrationService,
    NotificationPreferenceService,
    NotificationDispatcher,
    NotificationService,
    MockPushProvider,
    FcmPushProvider,
    ApnsPushProvider,
    {
      provide: PUSH_PROVIDER,
      useExisting: MockPushProvider,
    },
  ],
  exports: [
    NotificationService,
    DeviceRegistrationService,
    NotificationDispatcher,
    PUSH_PROVIDER,
  ],
})
export class NotificationsModule {}
