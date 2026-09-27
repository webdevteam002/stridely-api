import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CreateNotificationDto,
  RegisterDeviceDto,
  UpdateDevicePreferencesDto,
} from '../dto/notification.dto';
import { DeviceRegistrationService } from '../services/device-registration.service';
import { NotificationService } from '../services/notification.service';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DeviceRegistrationController {
  constructor(private readonly devices: DeviceRegistrationService) {}

  @Post('register')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register or update device for push notifications' })
  async register(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    const device = await this.devices.register({
      userId: user.userId,
      deviceId: dto.deviceId,
      platform: dto.platform,
      appVersion: dto.appVersion,
      locale: dto.locale,
      timezone: dto.timezone,
      pushToken: dto.pushToken,
      deviceName: dto.deviceName,
      notificationPreferences: dto.notificationPreferences,
      trusted: dto.trusted,
    });
    return this.devices.toPublic(device);
  }

  @Get()
  @ApiOperation({ summary: 'List registered devices for current user' })
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.devices.listForUser(user.userId);
    return rows.map((d) => this.devices.toPublic(d));
  }

  @Delete(':deviceId')
  @ApiOperation({ summary: 'Clear push token for a device (unregister push)' })
  async unregister(
    @CurrentUser() user: AuthUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    const device = await this.devices.clearPushToken(user.userId, deviceId);
    return this.devices.toPublic(device);
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create (and optionally dispatch) a notification' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notifications.create({
      userId: user.userId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      payload: dto.payload,
      priority: dto.priority,
      scheduledAt: dto.scheduledAt,
      deviceId: dto.deviceId,
      dispatch: dto.dispatch,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    return this.notifications.list(user.userId, status);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get per-device notification preferences' })
  getPreferences(
    @CurrentUser() user: AuthUser,
    @Query('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.notifications.getPreferences(user.userId, deviceId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update per-device notification preferences' })
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDevicePreferencesDto,
  ) {
    return this.notifications.updatePreferences(
      user.userId,
      dto.deviceId,
      dto.preferences as Record<string, boolean>,
    );
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by id' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.get(user.userId, id);
  }

  @Post(':id/dispatch')
  @ApiOperation({ summary: 'Dispatch a pending/failed notification' })
  dispatch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.dispatch(user.userId, id);
  }
}
