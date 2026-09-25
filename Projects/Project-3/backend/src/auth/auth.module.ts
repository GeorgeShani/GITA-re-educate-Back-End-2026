import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { DatabaseModule } from '#/database/database.module.js';
import { UsersModule } from '#/users/users.module.js';
import { AccountLookupService } from './account-lookup.service.js';
import { ApiKeyAuthenticationService } from './api-key-authentication.service.js';
import { AuthController } from './auth.controller.js';
import { AuthTokenService } from './auth-token.service.js';
import { AuthenticationService } from './authentication.service.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import { TokenFactory } from './crypto/token-factory.js';
import { InviteAcceptanceService } from './invite-acceptance.service.js';
import { GoogleOAuthProvider } from './oauth/google-oauth.provider.js';
import { IdentitiesService } from './oauth/identities.service.js';
import { OAuthController } from './oauth/oauth.controller.js';
import { GOOGLE_OAUTH, type OAuthProvider } from './oauth/oauth-provider.js';
import { OAuthRegistrationService } from './oauth/oauth-registration.service.js';
import { OAuthService } from './oauth/oauth.service.js';
import { OAuthStateService } from './oauth/oauth-state.service.js';
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
  controllers: [AuthController, OAuthController],
  providers: [
    PasswordHasher,
    TokenFactory,
    AuthTokenService,
    AuthenticationService,
    ApiKeyAuthenticationService,
    AccountLookupService,
    RegistrationService,
    SessionService,
    PasswordService,
    InviteAcceptanceService,
    OAuthStateService,
    OAuthService,
    OAuthRegistrationService,
    IdentitiesService,
    {
      // `null` when the GOOGLE_* variables are unset: password auth is unaffected
      // and the Google routes answer 503. Tests replace this with a fake.
      provide: GOOGLE_OAUTH,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): OAuthProvider | null =>
        config.googleOAuthEnabled &&
        config.GOOGLE_CLIENT_ID &&
        config.GOOGLE_CLIENT_SECRET &&
        config.GOOGLE_CALLBACK_URL
          ? new GoogleOAuthProvider({
              clientId: config.GOOGLE_CLIENT_ID,
              clientSecret: config.GOOGLE_CLIENT_SECRET,
              callbackUrl: config.GOOGLE_CALLBACK_URL,
            })
          : null,
    },
  ],
  // The guards are registered in `AccessControlModule`, where their order is
  // visible in one place. The token/session/lookup services are what the
  // employees module needs to invite, disable and re-invite people.
  exports: [AuthenticationService, ApiKeyAuthenticationService, AuthTokenService, SessionService, AccountLookupService],
})
export class AuthModule {}
