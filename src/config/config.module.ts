import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration, { authConfig } from './configuration';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [configuration, authConfig],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
