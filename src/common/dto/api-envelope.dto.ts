import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Standard Stridely API envelope (aligned with Flutter contract). */
export class ApiEnvelopeDto<T = unknown> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiPropertyOptional({ example: 'success' })
  status?: string;

  @ApiPropertyOptional({ example: 'OK' })
  message?: string;

  @ApiPropertyOptional()
  data?: T | null;

  @ApiPropertyOptional()
  error?: ProblemDetailsDto | null;

  @ApiPropertyOptional({ type: [Object], nullable: true })
  errors?: ApiErrorItemDto[] | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  meta?: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-07-15T10:30:00.000Z' })
  timestamp!: string;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class ApiErrorItemDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional()
  field?: string;
}

/** RFC 7807 problem details. */
export class ProblemDetailsDto {
  @ApiProperty({ example: 'https://api.stridely.app/problems/validation' })
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ example: 422 })
  status!: number;

  @ApiPropertyOptional()
  detail?: string;

  @ApiPropertyOptional()
  instance?: string;

  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional({ type: [ApiErrorItemDto] })
  errors?: ApiErrorItemDto[];
}

export function buildSuccessEnvelope<T>(
  data: T,
  requestId: string,
  meta?: Record<string, unknown> | null,
): ApiEnvelopeDto<T> {
  return {
    success: true,
    status: 'success',
    message: 'OK',
    data,
    error: null,
    errors: null,
    meta: meta ?? null,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function buildErrorEnvelope(
  problem: ProblemDetailsDto,
  requestId: string,
  message?: string,
): ApiEnvelopeDto<null> {
  return {
    success: false,
    status: 'error',
    message: message ?? problem.title,
    data: null,
    error: problem,
    errors: problem.errors ?? null,
    meta: null,
    timestamp: new Date().toISOString(),
    requestId,
  };
}
