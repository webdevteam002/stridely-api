import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  SyncAckDto,
  SyncBatchDto,
  SyncDownloadDto,
  SyncUploadDto,
} from '../dto/sync.dto';
import { SyncService } from '../services/sync.service';

@ApiTags('Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('upload')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Upload offline changes (idempotent)' })
  @ApiHeader({ name: 'X-Device-Id', required: false })
  @ApiHeader({ name: 'X-Request-Id', required: false })
  @ApiHeader({ name: 'X-Api-Version', required: false })
  upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: SyncUploadDto,
    @Headers('x-request-id') headerRequestId?: string,
  ) {
    return this.sync.upload({
      userId: user.userId,
      deviceId: dto.deviceId || user.deviceId,
      operations: dto.operations,
      requestId: dto.requestId ?? headerRequestId,
    });
  }

  @Post('download')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Download incremental changes since cursor' })
  download(@CurrentUser() user: AuthUser, @Body() dto: SyncDownloadDto) {
    return this.sync.download({
      userId: user.userId,
      deviceId: dto.deviceId || user.deviceId,
      cursor: dto.cursor,
      limit: dto.limit,
    });
  }

  @Post('batch')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Batch upload + download in one round-trip' })
  batch(
    @CurrentUser() user: AuthUser,
    @Body() dto: SyncBatchDto,
    @Headers('x-request-id') headerRequestId?: string,
  ) {
    return this.sync.batch({
      userId: user.userId,
      deviceId: dto.deviceId || user.deviceId,
      operations: dto.operations,
      cursor: dto.cursor,
      requestId: dto.requestId ?? headerRequestId,
    });
  }

  @Get('status')
  @ApiOperation({ summary: 'Sync engine / cursor status for current device' })
  status(@CurrentUser() user: AuthUser) {
    return this.sync.status(user.userId, user.deviceId);
  }

  @Post('ack')
  @ApiOperation({ summary: 'Acknowledge applied download cursor' })
  ack(@CurrentUser() user: AuthUser, @Body() dto: SyncAckDto) {
    return this.sync.ack({
      userId: user.userId,
      deviceId: dto.deviceId || user.deviceId,
      cursor: dto.cursor,
      changeIds: dto.changeIds,
    });
  }

  /** Contract aliases */
  @Post('push')
  @ApiOperation({ summary: 'Alias of /sync/upload' })
  push(
    @CurrentUser() user: AuthUser,
    @Body() dto: SyncUploadDto,
    @Headers('x-request-id') headerRequestId?: string,
  ) {
    return this.upload(user, dto, headerRequestId);
  }

  @Post('pull')
  @ApiOperation({ summary: 'Alias of /sync/download' })
  pull(@CurrentUser() user: AuthUser, @Body() dto: SyncDownloadDto) {
    return this.download(user, dto);
  }
}
