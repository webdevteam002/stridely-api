import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../../../database/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { ping: jest.Mock };

  beforeEach(async () => {
    prisma = { ping: jest.fn().mockResolvedValue(true) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              if (key === 'app.version') return '0.1.0';
              if (key === 'app.env') return 'test';
              return def;
            },
          },
        },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns ok when database is up', async () => {
    const health = await service.getHealth();
    expect(health.status).toBe('ok');
    expect(health.database.status).toBe('up');
    expect(health.version).toBe('0.1.0');
    expect(health.environment).toBe('test');
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns degraded when database is down', async () => {
    prisma.ping.mockRejectedValue(new Error('connection refused'));
    const health = await service.getHealth();
    expect(health.status).toBe('degraded');
    expect(health.database.status).toBe('down');
  });
});
