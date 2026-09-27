import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  const env = config.get<string>('app.env', 'development');
  const isProd = env === 'production';

  if (config.get<boolean>('app.trustProxy', false) || isProd) {
    const httpAdapter = app.getHttpAdapter();
    // Express behind reverse proxy / load balancer
    httpAdapter.getInstance().set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: isProd,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: isProd
        ? { maxAge: 15552000, includeSubDomains: true, preload: false }
        : false,
    }),
  );

  const apiPrefix = config.get<string>('app.apiPrefix', 'api/v1');
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health', 'health/live', 'health/ready'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  const corsOrigins = config.get<string>('app.corsOrigins', '*');
  if ((env === 'production' || env === 'staging') && corsOrigins === '*') {
    throw new Error(
      'CORS_ORIGINS must be an explicit allow-list in staging/production',
    );
  }
  app.enableCors({
    origin:
      corsOrigins === '*'
        ? true
        : corsOrigins.split(',').map((s) => s.trim()).filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Correlation-Id',
      'X-Device-Id',
      'X-App-Version',
      'X-Api-Version',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'X-Correlation-Id'],
    maxAge: 600,
  });

  if (config.get<boolean>('app.swaggerEnabled', false)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Stridely API')
      .setDescription(
        'Stridely NestJS API. Bearer JWT required for protected routes. ' +
          'CSRF: SPA clients use Authorization Bearer (not cookie sessions); ' +
          'see docs/PRODUCTION_HARDENING.md § CSRF.',
      )
      .setVersion(config.get<string>('app.version', '0.1.0'))
      .addBearerAuth()
      .addTag('Health')
      .addTag('Auth')
      .addTag('Devices')
      .addTag('Notifications')
      .addTag('Users')
      .addTag('Profiles')
      .addTag('Goals')
      .addTag('History')
      .addTag('Achievements')
      .addTag('Preferences')
      .addTag('Sync')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('app.port', 3000);
  // Bind all interfaces so cloud hosts (Koyeb, Docker, VMs) can reach the process.
  // Local `npm run start:dev` still works via localhost → 0.0.0.0.
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  logger.log(
    `Stridely API listening on ${host}:${port} (prefix=/${apiPrefix}, env=${env})`,
  );
}

void bootstrap();
