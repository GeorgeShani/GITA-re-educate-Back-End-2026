import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';

// Structured JSON logs (SCOPE.md B2 cross-cutting), every line tagged
// with the same correlationId ClsModule set up in AppModule — this is
// the piece that makes "one correlation id spans HTTP -> command ->
// event -> queue job -> email" actually visible in the logs rather than
// just true in principle. ClsModule's request middleware must run
// before this one, which it does as long as ClsModule is imported
// earlier in AppModule's imports array.
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, ClsService],
      useFactory: (configService: ConfigService, cls: ClsService) => ({
        // nestjs-pino's own configure() defaults `forRoutes` to the
        // hardcoded, pre-Express-5 [{ path: '*', method: ALL }] (see its
        // LoggerModule.js — not version-aware the way ClsModule's own
        // middleware mount point is). path-to-regexp (Express >=5) rejects
        // a bare `*`, so every boot logged two "Unsupported route path"
        // warnings — one per pino-http internal middleware, both sharing
        // this same default. '/' is exactly what ClsModule's own
        // Express-5 branch uses for "every route" (middleware.utils.js's
        // MOUNT_POINT_EXPRESS_5), so this isn't a narrower match — it's
        // the modern equivalent of what '*' meant under Express 4.
        forRoutes: ['/'],
        pinoHttp: {
          level:
            configService.get<string>('NODE_ENV') === 'production'
              ? 'info'
              : 'debug',
          customProps: () => ({
            correlationId: cls.isActive()
              ? cls.get<string | undefined>('correlationId')
              : undefined,
          }),
          transport:
            configService.get<string>('NODE_ENV') === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
