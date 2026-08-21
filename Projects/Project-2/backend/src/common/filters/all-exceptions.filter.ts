import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ClsService } from 'nestjs-cls';

// Catches everything Nest's own HttpException handling doesn't — i.e.
// genuinely unexpected errors. Known errors (NotFoundException, etc.)
// should be thrown deliberately in services per backend/AGENTS.md; this
// filter's job is to stop an unhandled exception from leaking a stack
// trace to the client and to make sure it's actually logged.
//
// Reads correlationId from ClsService (SCOPE.md B2 cross-cutting) so
// every error response and log line can be tied back to one request —
// the correlation-id middleware that populates it lands in the event
// backbone (core/), but this filter is written against the interface now
// so nothing here needs to change once that middleware exists.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    const correlationId = this.cls.isActive()
      ? this.cls.get<string | undefined>('correlationId')
      : undefined;

    if (!isHttpException) {
      const stack =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `Unhandled exception${correlationId ? ` [${correlationId}]` : ''}: ${stack}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      ...(typeof body === 'object' ? body : { message: body }),
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
