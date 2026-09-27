import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SyncOperationDto {
  @ApiProperty({ example: 'daily_activity' })
  @IsString()
  entityType!: string;

  @ApiProperty()
  @IsString()
  entityId!: string;

  @ApiProperty({ enum: ['create', 'update', 'delete', 'upsert', 'merge'] })
  @IsIn(['create', 'update', 'delete', 'upsert', 'merge', 'soft_delete'])
  operation!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  clientVersion!: number;

  @ApiProperty({ type: Object })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientUpdatedAt?: string;

  @ApiPropertyOptional({
    enum: [
      'last_write_wins',
      'client_wins',
      'server_wins',
      'merge',
      'union',
    ],
  })
  @IsOptional()
  @IsIn([
    'last_write_wins',
    'client_wins',
    'server_wins',
    'merge',
    'union',
  ])
  conflictStrategy?:
    | 'last_write_wins'
    | 'client_wins'
    | 'server_wins'
    | 'merge'
    | 'union';
}

export class SyncUploadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;

  @ApiProperty({ type: [SyncOperationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations!: SyncOperationDto[];

  @ApiPropertyOptional({ description: 'Idempotency / request id' })
  @IsOptional()
  @IsString()
  requestId?: string;
}

export class SyncDownloadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class SyncBatchDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;

  @ApiProperty({ type: [SyncOperationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations!: SyncOperationDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestId?: string;
}

export class SyncAckDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;

  @ApiProperty()
  @IsString()
  cursor!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  changeIds?: string[];
}
