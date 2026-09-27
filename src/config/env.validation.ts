import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'staging', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_NAME: z.string().default('stridely-api'),
    APP_VERSION: z.string().default('0.1.0'),
    API_PREFIX: z.string().default('api/v1'),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine(
        (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
        'DATABASE_URL must be a PostgreSQL connection string (Neon)',
      ),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGINS: z.string().default('*'),
    SWAGGER_ENABLED: z
      .union([z.boolean(), z.string()])
      .transform((v) => (typeof v === 'boolean' ? v : v !== 'false'))
      .optional(),
    JWT_SECRET: z.string().min(16).optional(),
    JWT_ISSUER: z.string().default('stridely-api'),
    JWT_AUDIENCE: z.string().default('stridely-app'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    JWT_CLOCK_SKEW_SECONDS: z.coerce.number().int().nonnegative().default(60),
    AUTH_THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
    AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),
    SKIP_DB_CONNECT: z
      .union([z.boolean(), z.string()])
      .transform((v) =>
        typeof v === 'boolean' ? v : v === 'true' || v === '1',
      )
      .default(false),
    TRUST_PROXY: z
      .union([z.boolean(), z.string()])
      .transform((v) =>
        typeof v === 'boolean' ? v : v === 'true' || v === '1',
      )
      .default(false),
  })
  .superRefine((data, ctx) => {
    const isProd = data.NODE_ENV === 'production';
    const isStaging = data.NODE_ENV === 'staging';

    if (isProd && !data.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET is required in production',
      });
    }
    if (isProd && data.JWT_SECRET && data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production',
      });
    }
    if (
      (isProd || isStaging) &&
      (data.CORS_ORIGINS.trim() === '*' || data.CORS_ORIGINS.trim() === '')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message:
          'CORS_ORIGINS must be an explicit allow-list in staging/production (not *)',
      });
    }
    if (isProd && data.SKIP_DB_CONNECT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SKIP_DB_CONNECT'],
        message: 'SKIP_DB_CONNECT must be false in production',
      });
    }
  })
  .transform((data) => {
    // Swagger: default on in dev/test, off in staging/production unless forced
    const swaggerEnabled =
      data.SWAGGER_ENABLED !== undefined
        ? data.SWAGGER_ENABLED
        : data.NODE_ENV === 'development' || data.NODE_ENV === 'test';
    return { ...data, SWAGGER_ENABLED: swaggerEnabled };
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }
  return parsed.data;
}
