import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

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
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configService = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'admin/queues'] });

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
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(configService.get<number>('PORT', 3000));
}

void bootstrap();
