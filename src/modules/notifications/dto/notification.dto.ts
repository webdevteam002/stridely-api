import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NOTIFICATION_TYPES } from '../notification.constants';

export class NotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  goals?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  achievements?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  weeklySummary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  system?: boolean;
}

export class RegisterDeviceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;

  @ApiPropertyOptional({ example: 'android' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional({ example: 'en-US' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pushToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({ type: NotificationPreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trusted?: boolean;
}

export class UpdateDevicePreferencesDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;

  @ApiProperty({ type: NotificationPreferencesDto })
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  preferences!: NotificationPreferencesDto;
}

export class CreateNotificationDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES })
  @IsIn([...NOTIFICATION_TYPES])
  type!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['low', 'normal', 'high'] })
  @IsOptional()
  @IsIn(['low', 'normal', 'high'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Client device UUID to target a single device',
  })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'When false, create only (no immediate dispatch)',
  })
  @IsOptional()
  @IsBoolean()
  dispatch?: boolean;
}
