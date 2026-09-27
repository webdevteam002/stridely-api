import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { buildSuccessEnvelope } from '../dto/api-envelope.dto';

/**
 * Wraps controller return values in the standard API envelope unless they
 * already look like an envelope (`success` + `requestId`).
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { id?: string }>();
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ??
      request.id ??
      uuidv4();

    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'requestId' in data
        ) {
          return data;
        }
        return buildSuccessEnvelope(data, requestId);
      }),
    );
  }
}
