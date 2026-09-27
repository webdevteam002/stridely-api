import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiErrorItemDto,
  ProblemDetailsDto,
  buildErrorEnvelope,
} from '../dto/api-envelope.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ??
      request.id ??
      uuidv4();
    const errorId = uuidv4();

    const { status, problem } = this.toProblem(
      exception,
      request.url,
      errorId,
    );

    this.logger.error(
      {
        err: exception instanceof Error ? exception.message : String(exception),
        requestId,
        errorId,
        status,
        path: request.url,
      },
      'Request failed',
    );

    response
      .status(status)
      .setHeader('X-Request-Id', requestId)
      .setHeader('X-Error-Id', errorId)
      .json(buildErrorEnvelope(problem, requestId));
  }

  private toProblem(
    exception: unknown,
    instance: string,
    errorId: string,
  ): { status: number; problem: ProblemDetailsDto } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const title =
        typeof payload === 'string'
          ? payload
          : ((payload as { error?: string; message?: string | string[] })
              .error ?? exception.message);
      const messageField =
        typeof payload === 'object' && payload !== null
          ? (payload as { message?: string | string[] }).message
          : undefined;

      const errors: ApiErrorItemDto[] = Array.isArray(messageField)
        ? messageField.map((m) => ({
            code: 'VALIDATION_ERROR',
            message: m,
          }))
        : typeof messageField === 'string' && messageField !== title
          ? [{ code: 'HTTP_ERROR', message: messageField }]
          : [];

      return {
        status,
        problem: {
          type: `https://api.stridely.app/problems/http-${status}`,
          title: typeof title === 'string' ? title : 'Error',
          status,
          detail:
            typeof messageField === 'string' ? messageField : undefined,
          instance,
          code: `HTTP_${status}`,
          errors: errors.length ? errors : undefined,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      problem: {
        type: 'https://api.stridely.app/problems/internal',
        title: 'Internal Server Error',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'An unexpected error occurred',
        instance,
        code: 'INTERNAL_ERROR',
        errors: [{ code: 'INTERNAL_ERROR', message: `errorId=${errorId}` }],
      },
    };
  }
}
