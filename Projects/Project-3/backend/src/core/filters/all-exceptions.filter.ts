import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { RequestContextService } from '#/core/context/request-context.service.js';

/** The error contract every non-2xx response honours. */
export interface ErrorEnvelope {
  statusCode: number;
  message: string | string[];
  /** The same id that is on every log line for this request. */
  correlationId?: string;
  timestamp: string;
}

/**
 * Global exception filter.
 *
 * Registered as an `APP_FILTER` provider rather than via
 * `app.useGlobalFilters(new AllExceptionsFilter())`, because it needs DI — the
 * manual form gets no injector, so the logger and the request context would be
 * unavailable.
 *
 * The envelope's value is that the `correlationId` handed to the client is the
 * same one stamped on every log line for that request, so a bug report quoting
 * it goes straight to the relevant logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly context: RequestContextService,
  ) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): unknown {
    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? extractMessage(exception.getResponse())
      : 'Internal server error';

    // Project-2's filter logged only unhandled errors and used Nest's Logger, so
    // 4xx/5xx HttpExceptions were invisible and nothing it wrote was structured.
    // Both are fixed here: everything is logged, through pino, at a severity
    // that matches the status.
    if (!isHttpException || statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          err: exception,
          statusCode,
          stack: exception instanceof Error ? exception.stack : undefined,
        },
        isHttpException ? 'Request failed' : 'Unhandled exception',
      );
    } else {
      this.logger.warn({ statusCode, message }, 'Request rejected');
    }

    // GraphQL has no `Response` to write: hand the error back and Apollo formats it as a GraphQL
    // error (the message and status survive; the REST envelope does not apply). An unexpected error
    // is replaced, exactly as REST does above: its own message could be a database or library detail.
    if (host.getType<string>() === 'graphql') {
      return isHttpException ? exception : new InternalServerErrorException('Internal server error');
    }

    const response = host.switchToHttp().getResponse<Response>();
    const envelope: ErrorEnvelope = {
      statusCode,
      message,
      correlationId: this.context.correlationId,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(envelope);
  }
}

/**
 * Nest's exception bodies are inconsistent: a bare `throw new
 * NotFoundException('x')` yields `{ message: 'x' }`, while ValidationPipe yields
 * `{ message: [...] }`, and a thrown string yields the string itself.
 */
function extractMessage(body: string | object): string | string[] {
  if (typeof body === 'string') return body;

  const message = hasMessageProperty(body) ? body.message : undefined;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(String);

  return 'Request failed';
}

/** Type-predicate guard, not an assertion — `in` narrows `body` for real. */
function hasMessageProperty(body: object): body is { message: unknown } {
  return 'message' in body;
}
