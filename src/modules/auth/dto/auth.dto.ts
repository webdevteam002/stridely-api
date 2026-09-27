import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DeviceContextDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceName?: string;

  @ApiPropertyOptional({ example: 'android' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  platform?: string;

  @ApiPropertyOptional({ example: '1.0.0+42' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  pushToken?: string | null;
}

export class RegisterDto extends DeviceContextDto {
  @ApiProperty({ example: 'alex@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

export class LoginDto extends DeviceContextDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

export class AnonymousDto extends DeviceContextDto {
  @ApiPropertyOptional({
    description: 'Client-stable anonymous key; generated if omitted',
  })
  @IsOptional()
  @IsUUID()
  anonymousKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

export class GuestUpgradeDto extends DeviceContextDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

export class LogoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({
    description: 'Revoke all refresh tokens for the user',
  })
  @IsOptional()
  @IsBoolean()
  revokeAll?: boolean;
}

export class TrustDeviceDto {
  @ApiProperty({
    description: 'Database row id of the device (not client deviceId)',
  })
  @IsUUID()
  deviceRowId!: string;
}

/** Future providers — stub DTOs for OpenAPI. */
export class SocialAuthStubDto extends DeviceContextDto {
  @ApiProperty({
    description: 'Identity token from Apple / Google',
  })
  @IsString()
  identityToken!: string;

  @ApiPropertyOptional({ description: 'Optional display name override' })
  @IsOptional()
  @IsString()
  displayName?: string;
}
