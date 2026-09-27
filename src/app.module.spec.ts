import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';

describe('Application bootstrap', () => {
  it('compiles AppModule with mocked Prisma', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        ping: jest.fn().mockResolvedValue(true),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn(),
      })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('loads ConfigModule independently', async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://test:test@localhost:5432/stridely_test';
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              app: {
                name: 'stridely-api',
                version: '0.1.0',
                env: 'test',
                port: 3001,
              },
            }),
          ],
        }),
      ],
    }).compile();

    expect(moduleRef.get(ConfigModule)).toBeDefined();
    await moduleRef.close();
  });
});
