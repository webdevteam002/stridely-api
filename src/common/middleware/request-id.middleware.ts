import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export type RequestWithIds = Request & {
  id?: string;
  correlationId?: string;
};

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithIds, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ?? requestId;

    req.id = requestId;
    req.correlationId = correlationId;
    req.headers['x-request-id'] = requestId;
    req.headers['x-correlation-id'] = correlationId;

    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  }
}
