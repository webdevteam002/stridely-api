import { validateEnv } from './env.validation';

describe('validateEnv (production hardening)', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  };

  it('allows development with CORS *', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'development',
      CORS_ORIGINS: '*',
    });
    expect(env.SWAGGER_ENABLED).toBe(true);
  });

  it('rejects production CORS *', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: '*',
        JWT_SECRET: 'a'.repeat(32),
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('requires long JWT_SECRET in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.stridely.app',
        JWT_SECRET: 'too-short-secret!',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('rejects SKIP_DB_CONNECT in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.stridely.app',
        JWT_SECRET: 'a'.repeat(32),
        SKIP_DB_CONNECT: 'true',
      }),
    ).toThrow(/SKIP_DB_CONNECT/);
  });

  it('defaults swagger off in staging', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'staging',
      CORS_ORIGINS: 'https://staging.stridely.app',
      JWT_SECRET: 'a'.repeat(32),
    });
    expect(env.SWAGGER_ENABLED).toBe(false);
  });
});
