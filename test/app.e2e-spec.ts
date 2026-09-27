import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DB_CONNECT = 'true';
    process.env.DATABASE_URL =
      'postgresql://test:test@localhost:5432/stridely_test';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.LOG_LEVEL = 'silent';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
        ping: jest.fn().mockResolvedValue(true),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
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

  it('GET /health returns envelope with database status', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database.status).toBe('up');
    expect(res.body.data.version).toBeDefined();
    expect(res.body.data.environment).toBeDefined();
    expect(res.body.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /health/live returns alive', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(res.body.data.status).toBe('alive');
  });

  it('GET /health/ready returns ready when DB up', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);
    expect(res.body.data.status).toBe('ready');
  });
});
