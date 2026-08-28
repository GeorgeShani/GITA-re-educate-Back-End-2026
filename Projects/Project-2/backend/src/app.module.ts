import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { minutes, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import type { StringValue } from 'ms';
import { ClsModule } from 'nestjs-cls';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HealthModule } from './health/health.module';
import { CoreModule } from './core/core.module';
import { LoggingModule } from './core/logging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MediaModule } from './media/media.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CartModule } from './cart/cart.module';
import { ShippingModule } from './shipping/shipping.module';
import { TaxModule } from './tax/tax.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { CheckoutModule } from './checkout/checkout.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReturnsModule } from './returns/returns.module';
import { AdminModule } from './admin/admin.module';
import { CouponsModule } from './coupons/coupons.module';
import { GiftCardsModule } from './gift-cards/gift-cards.module';
import { BlogModule } from './blog/blog.module';
import { PagesModule } from './pages/pages.module';
import { ContactModule } from './contact/contact.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { SitemapModule } from './sitemap/sitemap.module';
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [
    // Registered even when SENTRY_DSN is unset — Sentry.init() (see
    // instrument.ts) is the actual on/off switch; this just wires up the
    // Nest-level plumbing @SentryExceptionCaptured() (all-exceptions.filter.ts)
    // needs, which no-ops safely if Sentry was never initialized.
    SentryModule.forRoot(),

    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    // Request-scoped storage — every HTTP request gets a correlationId,
    // reused (rather than regenerated) when the caller already supplies
    // one via X-Correlation-Id, so a request can be traced across
    // service boundaries. The event backbone (core/) propagates this
    // same id onto outbox rows and queue jobs — see SCOPE.md B2.
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (
          cls,
          req: { headers: Record<string, string | string[] | undefined> },
        ) => {
          const header = req.headers['x-correlation-id'];
          const correlationId =
            (Array.isArray(header) ? header[0] : header) ?? randomUUID();
          cls.set('correlationId', correlationId);
        },
      },
    }),

    // Must come after ClsModule in this array so its request middleware
    // registers second — pino's customProps callback (see logging.module)
    // reads the correlationId ClsModule just set.
    LoggingModule,

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
      }),
    }),

    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_EXPIRES_IN',
            '15m',
          ) as StringValue,
        },
      }),
    }),

    ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 60 }]),

    // maxRetriesPerRequest: null + enableReadyCheck: false per SCOPE.md
    // B3 — required for BullMQ's blocking connections against serverless
    // Redis providers like Upstash; harmless against Railway Redis too.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
      }),
    }),

    CqrsModule.forRoot(),
    ScheduleModule.forRoot(),
    HealthModule,
    CoreModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    MediaModule,
    CatalogModule,
    InventoryModule,
    ReviewsModule,
    CartModule,
    ShippingModule,
    TaxModule,
    PaymentsModule,
    OrdersModule,
    CheckoutModule,
    WishlistModule,
    ReturnsModule,
    AdminModule,
    CouponsModule,
    GiftCardsModule,
    BlogModule,
    PagesModule,
    ContactModule,
    NewsletterModule,
    SitemapModule,
    AssistantModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
