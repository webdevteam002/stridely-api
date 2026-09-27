import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../services/auth.service';
import { DeviceService } from '../services/device.service';
import { PasswordService } from '../services/password.service';
import { SessionService } from '../services/session.service';
import { TokenService } from '../services/token.service';
import { authConfig } from '../../../config/configuration';
import { createInMemoryPrisma } from './in-memory-prisma';

describe('AuthService', () => {
  let auth: AuthService;
  let prisma: ReturnType<typeof createInMemoryPrisma>;
  const deviceId = uuidv4();

  beforeEach(async () => {
    prisma = createInMemoryPrisma();
    process.env.JWT_SECRET = 'test-jwt-secret-key-32chars!!';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            authConfig,
            () => ({
              auth: {
                jwtSecret: 'test-jwt-secret-key-32chars!!',
                issuer: 'stridely-api',
                audience: 'stridely-app',
                accessTtl: '15m',
                refreshTtlDays: 30,
                clockSkewSeconds: 60,
              },
            }),
          ],
        }),
        JwtModule.register({
          secret: 'test-jwt-secret-key-32chars!!',
        }),
      ],
      providers: [
        AuthService,
        TokenService,
        PasswordService,
        DeviceService,
        SessionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    auth = module.get(AuthService);
  });

  const device = {
    deviceId,
    deviceName: 'Pixel Test',
    platform: 'android',
    appVersion: '1.0.0',
  };

  it('registers a user and returns tokens + device', async () => {
    const result = await auth.register(
      {
        email: 'alex@example.com',
        password: 'SecurePass1',
        displayName: 'Alex',
      },
      device,
    );
    expect(result.user.email).toBe('alex@example.com');
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect(result.device.deviceId).toBe(deviceId);
  });

  it('rejects duplicate accounts', async () => {
    await auth.register(
      { email: 'dup@example.com', password: 'SecurePass1' },
      device,
    );
    await expect(
      auth.register(
        { email: 'dup@example.com', password: 'SecurePass1' },
        { ...device, deviceId: uuidv4() },
      ),
    ).rejects.toMatchObject({ response: { code: 'DUPLICATE_ACCOUNT' } });
  });

  it('rejects weak passwords', async () => {
    await expect(
      auth.register({ email: 'w@example.com', password: '123' }, device),
    ).rejects.toMatchObject({ response: { code: 'WEAK_PASSWORD' } });
  });

  it('logs in and supports multiple devices', async () => {
    await auth.register(
      { email: 'multi@example.com', password: 'SecurePass1' },
      device,
    );
    const second = await auth.login(
      { email: 'multi@example.com', password: 'SecurePass1' },
      {
        deviceId: uuidv4(),
        deviceName: 'iPhone',
        platform: 'ios',
        appVersion: '1.0.0',
      },
    );
    const devices = await auth.listDevices(second.user.id);
    expect(devices.length).toBe(2);
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const registered = await auth.register(
      { email: 'rot@example.com', password: 'SecurePass1' },
      device,
    );
    const oldRefresh = registered.tokens.refreshToken;
    const refreshed = await auth.refresh(oldRefresh);
    expect(refreshed.tokens.accessToken).toBeDefined();
    expect(refreshed.tokens.refreshToken).not.toBe(oldRefresh);

    await expect(auth.refresh(oldRefresh)).rejects.toMatchObject({
      response: { code: 'REVOKED_REFRESH_TOKEN' },
    });
  });

  it('logs out and invalidates refresh token', async () => {
    const registered = await auth.register(
      { email: 'out@example.com', password: 'SecurePass1' },
      device,
    );
    await auth.logout(registered.user.id, registered.tokens.refreshToken);
    await expect(
      auth.refresh(registered.tokens.refreshToken),
    ).rejects.toBeDefined();
  });

  it('creates anonymous user and upgrades to email', async () => {
    const anon = await auth.anonymousLocal({ displayName: 'Guest' }, device);
    expect(anon.user.accountType).toBe('anonymous');
    const upgraded = await auth.upgradeGuest(
      anon.user.id,
      { email: 'guest@example.com', password: 'SecurePass1' },
      device,
    );
    expect(upgraded.user.accountType).toBe('email');
    expect(upgraded.user.email).toBe('guest@example.com');
  });

  it('trusts and revokes devices', async () => {
    const registered = await auth.register(
      { email: 'dev@example.com', password: 'SecurePass1' },
      device,
    );
    const trusted = await auth.trustDevice(
      registered.user.id,
      registered.device.id,
    );
    expect(trusted.trusted).toBe(true);

    const revoked = await auth.revokeDevice(
      registered.user.id,
      registered.device.id,
    );
    expect(revoked.id).toBe(registered.device.id);
    const remaining = await auth.listDevices(registered.user.id);
    expect(remaining.length).toBe(0);
  });

  it('returns me for authenticated user', async () => {
    const registered = await auth.register(
      { email: 'me@example.com', password: 'SecurePass1' },
      device,
    );
    const me = await auth.me(registered.user.id);
    expect(me.id).toBe(registered.user.id);
  });
});
