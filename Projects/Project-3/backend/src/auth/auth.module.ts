import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { RolesGuard } from '#/common/auth/roles.guard.js';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { DatabaseModule } from '#/database/database.module.js';
import { UsersModule } from '#/users/users.module.js';
import { AccountLookupService } from './account-lookup.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthTokenService } from './auth-token.service.js';
import { AuthenticationService } from './authentication.service.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import { TokenFactory } from './crypto/token-factory.js';
import { PasswordService } from './password.service.js';
import { RegistrationService } from './registration.service.js';
import { SessionService } from './session.service.js';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_ACCESS_SECRET,
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    PasswordHasher,
    TokenFactory,
    AuthTokenService,
    AuthenticationService,
    AccountLookupService,
    RegistrationService,
    SessionService,
    PasswordService,
    // Order is the guard order: identify first, then narrow by role.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthenticationService],
})
export class AuthModule {}
