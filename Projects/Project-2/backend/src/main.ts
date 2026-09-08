import './instrument';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { getProcessRole } from '@/common/utils/process-role.util';
import { setupBullBoard } from './bull-board.setup';

async function bootstrap() {
  // rawBody: true — Stripe webhook signature verification (S9) needs the
  // unparsed request body; class-validator/global pipes still apply to
  // the parsed body on every other route.
  //
  // Deliberately NOT swapping Nest's own framework logger to pino via
  // app.useLogger() — verified via a real boot test that `bufferLogs:
  // true` + `useLogger(app.get(Logger))` silently drops every log line
  // in this exact stack (Nest 11 + nestjs-pino 4.6.1), and even without
  // bufferLogs, module bootstrap happens inside NestFactory.create()
  // itself, before useLogger() ever runs — so it can't intercept that
  // phase anyway. What SCOPE.md B2 actually needs (every log line
  // carrying one correlationId) is delivered by LoggingModule's
  // pino-http auto-logging of HTTP requests, not by Nest's own
  // "ModuleXYZ initialized" bootstrap chatter — see core/logging.module.ts.
  // 'debug'/'verbose' off: the framework's own bootstrap chatter is
  // already treated as noise per the comment above (structured,
  // correlationId-tagged logging comes from pino-http, not this logger).
  // ClsModule specifically logs its middleware-mount decision at 'debug'
  // on every boot — silencing the level is the fix, not chasing a
  // per-module toggle.
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['log', 'error', 'warn'],
  });

  const configService = app.get(ConfigService);

  app.use(helmet());
  // Signed so the guest-cart token (S8) can't be tampered with client-side
  // — Cart lookups trust it as-is, with no further ownership check.
  app.use(cookieParser(configService.getOrThrow<string>('COOKIE_SECRET')));
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
    credentials: true,
  });
  // sitemap.xml/robots.txt (S11) join health/admin-queues here — crawlers
  // expect both at the domain root, not under the API prefix.
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'admin/queues', 'sitemap.xml', 'robots.txt'],
  });

  // Own Basic-Auth gate, own Express router (not a Nest controller) — see
  // bull-board.setup.ts. Only mounts when BULL_BOARD_USERNAME/PASSWORD
  // are both set.
  setupBullBoard(app, configService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('3legant API')
    .setDescription('API documentation for the 3legant Golf e-commerce backend')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  // A worker exposes no public API worth documenting; it still listens so
  // the platform's health check has something to hit.
  if (getProcessRole() !== 'worker') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(configService.get<number>('PORT', 4000));
  // Which half this process is running is the first thing you want to know
  // when a queue is not draining or a job ran twice.
  new Logger('Bootstrap').log(`Process role: ${getProcessRole()}`);
}

void bootstrap();
