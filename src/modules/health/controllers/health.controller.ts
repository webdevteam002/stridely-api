import {
  Controller,
  Get,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService, HealthPayload } from '../services/health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Application health',
    description:
      'Returns uptime, version, environment, and PostgreSQL connectivity.',
  })
  getHealth(): Promise<HealthPayload> {
    return this.healthService.getHealth();
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Process is up (no dependency checks). For k8s/load balancers.',
  })
  live() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Ready to accept traffic when database is reachable.',
  })
  async ready(@Res({ passthrough: true }) res: Response) {
    const payload = await this.healthService.getReadiness();
    if (payload.status !== 'ready') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return payload;
  }
}
