import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

export type HealthPayload = {
  status: 'ok' | 'degraded' | 'error';
  uptimeSeconds: number;
  version: string;
  environment: string;
  database: {
    status: 'up' | 'down';
    latencyMs?: number;
  };
  timestamp: string;
};

export type LivenessPayload = {
  status: 'alive';
  uptimeSeconds: number;
  timestamp: string;
};

export type ReadinessPayload = {
  status: 'ready' | 'not_ready';
  database: HealthPayload['database'];
  timestamp: string;
};

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getHealth(): Promise<HealthPayload> {
    const db = await this.checkDatabase();
    const status: HealthPayload['status'] =
      db.status === 'up' ? 'ok' : 'degraded';

    return {
      status,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      version: this.config.get<string>('app.version', '0.1.0'),
      environment: this.config.get<string>('app.env', 'development'),
      database: db,
      timestamp: new Date().toISOString(),
    };
  }

  getLiveness(): LivenessPayload {
    return {
      status: 'alive',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessPayload> {
    const db = await this.checkDatabase();
    return {
      status: db.status === 'up' ? 'ready' : 'not_ready',
      database: db,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<HealthPayload['database']> {
    const start = Date.now();
    try {
      await this.prisma.ping();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: Date.now() - start };
    }
  }
}
