import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { createInMemoryPrisma } from '../src/modules/auth/tests/in-memory-prisma';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const deviceId = uuidv4();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DB_CONNECT = 'true';
    process.env.DATABASE_URL =
      'postgresql://test:test@localhost:5432/stridely_test';
    process.env.JWT_SECRET = 'test-jwt-secret-key-32chars!!';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.LOG_LEVEL = 'silent';

    const prisma = createInMemoryPrisma();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'health/live', 'health/ready'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/register → login → refresh → me', async () => {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'e2e@example.com',
        password: 'SecurePass1',
        deviceId,
        platform: 'android',
        appVersion: '1.0.0',
      })
      .expect(201);

    expect(register.body.success).toBe(true);
    expect(register.body.data.tokens.accessToken).toBeDefined();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'e2e@example.com',
        password: 'SecurePass1',
        deviceId,
      })
      .expect(200);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.data.tokens.refreshToken })
      .expect(200);

    expect(refresh.body.data.tokens.refreshToken).not.toBe(
      login.body.data.tokens.refreshToken,
    );

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refresh.body.data.tokens.accessToken}`)
      .expect(200);

    expect(me.body.data.email).toBe('e2e@example.com');
  });

  it('lists and revokes devices', async () => {
    const deviceA = uuidv4();
    const deviceB = uuidv4();
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'devices@example.com',
        password: 'SecurePass1',
        deviceId: deviceA,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'devices@example.com',
        password: 'SecurePass1',
        deviceId: deviceB,
      })
      .expect(200);

    const token = reg.body.data.tokens.accessToken;
    const list = await request(app.getHttpServer())
      .get('/api/v1/auth/devices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.data.length).toBeGreaterThanOrEqual(2);

    const rowId = list.body.data[0].id as string;
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/devices/${rowId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
