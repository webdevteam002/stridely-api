import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { GoalsModule } from './modules/goals/goals.module';
import { HistoryModule } from './modules/history/history.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { SyncModule } from './modules/sync/sync.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PremiumModule } from './modules/premium/premium.module';
import { ObservabilityModule } from './common/observability/observability.module';

@Module({
  imports: [
    AppConfigModule,
    ObservabilityModule,
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 60),
      },
    ]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production' &&
          process.env.NODE_ENV !== 'test'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        genReqId: (req) =>
          (req.headers['x-request-id'] as string | undefined) ??
          (req.headers['x-correlation-id'] as string | undefined) ??
          crypto.randomUUID(),
        customProps: (req) => ({
          requestId: req.headers['x-request-id'],
          correlationId: req.headers['x-correlation-id'],
        }),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
      },
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    UsersModule,
    ProfilesModule,
    GoalsModule,
    HistoryModule,
    AchievementsModule,
    PreferencesModule,
    SyncModule,
    NotificationsModule,
    PremiumModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
