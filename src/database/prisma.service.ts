import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_DB_CONNECT === 'true') {
      this.logger.warn('Skipping Prisma $connect (SKIP_DB_CONNECT=true)');
      return;
    }
    await this.$connect();
    this.connected = true;
    this.logger.log('Prisma connected to PostgreSQL (Neon)');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected || process.env.SKIP_DB_CONNECT !== 'true') {
      await this.$disconnect();
      this.logger.log('Prisma disconnected');
    }
  }

  /** Lightweight connectivity probe for health checks. */
  async ping(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
