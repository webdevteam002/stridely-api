import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const env = process.env.NODE_ENV ?? 'development';
  const swaggerExplicit = process.env.SWAGGER_ENABLED;
  const swaggerEnabled =
    swaggerExplicit !== undefined
      ? swaggerExplicit !== 'false'
      : env === 'development' || env === 'test';

  return {
    name: process.env.APP_NAME ?? 'stridely-api',
    version: process.env.APP_VERSION ?? '0.1.0',
    env,
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    corsOrigins: process.env.CORS_ORIGINS ?? '*',
    swaggerEnabled,
    databaseUrl: process.env.DATABASE_URL ?? '',
    trustProxy:
      process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
    skipDbConnect:
      process.env.SKIP_DB_CONNECT === 'true' ||
      process.env.SKIP_DB_CONNECT === '1',
  };
});

export const authConfig = registerAs('auth', () => ({
  jwtSecret:
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === 'production'
      ? undefined
      : 'dev-only-stridely-jwt-secret-change-me'),
  issuer: process.env.JWT_ISSUER ?? 'stridely-api',
  audience: process.env.JWT_AUDIENCE ?? 'stridely-app',
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
  clockSkewSeconds: Number(process.env.JWT_CLOCK_SKEW_SECONDS ?? 60),
  throttleTtlMs: Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60_000),
  throttleLimit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 60),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
}));

export type AppConfig = {
  name: string;
  version: string;
  env: string;
  port: number;
  apiPrefix: string;
  logLevel: string;
  corsOrigins: string;
  swaggerEnabled: boolean;
  databaseUrl: string;
  trustProxy: boolean;
  skipDbConnect: boolean;
};
