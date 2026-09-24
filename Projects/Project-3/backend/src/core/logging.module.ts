import { Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG } from '#/config/load-config.js';
import type { AppConfig } from '#/config/env.schema.js';
import './context/cls-store.js';
import {
  REDACT_CENSOR,
  REDACT_PINO_PATHS,
} from './redaction.js';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG, ClsService],
      useFactory: (config: AppConfig, cls: ClsService) => ({
        // MUST be ['/'], never ['*']. nestjs-pino's own default is a bare '*',
        // which Express 5's path-to-regexp rejects outright — you get two
        // "Unsupported route path" warnings every boot. '/' is what nestjs-cls
        // uses for "every route", so this is not a narrower match.
        forRoutes: ['/'],
        pinoHttp: {
          level: config.LOG_LEVEL,

          // Stamps every line with the request context, so a log line and its
          // trace are one lookup apart in either direction.
          customProps: () =>
            cls.isActive()
              ? {
                  correlationId: cls.get('correlationId'),
                  companyId: cls.get('companyId'),
                  userId: cls.get('userId'),
                }
              : {},

          redact: {
            paths: REDACT_PINO_PATHS,
            censor: REDACT_CENSOR,
          },

          // Healthchecks fire every 10s in Docker; at info they bury everything
          // else. Errors on them still surface.
          autoLogging: {
            ignore: (req) => req.url === '/health',
          },

          // pino-pretty is a devDependency and is therefore absent from the
          // Docker runtime stage (`npm ci --omit=dev`). Gate on NODE_ENV, which
          // the Dockerfile sets to production — never on a separate flag that
          // could be true in an image where the transport isn't installed.
          transport: config.isProduction
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'HH:MM:ss.l' },
              },
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
