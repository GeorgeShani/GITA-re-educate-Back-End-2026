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
