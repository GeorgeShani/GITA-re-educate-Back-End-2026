import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import type { StringValue } from 'ms';

import { CoreModule } from '../core/core.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterUserHandler } from './commands/handlers/register-user.handler';
import { VerifyEmailHandler } from './commands/handlers/verify-email.handler';
import { RecordLoginHandler } from './commands/handlers/record-login.handler';
import { RequestPasswordResetHandler } from './commands/handlers/request-password-reset.handler';
import { ResetPasswordHandler } from './commands/handlers/reset-password.handler';
import { REFRESH_JWT_SERVICE_TOKEN } from './refresh-jwt.token';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';

const COMMAND_HANDLERS = [
  RegisterUserHandler,
  VerifyEmailHandler,
  RecordLoginHandler,
  RequestPasswordResetHandler,
  ResetPasswordHandler,
];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    UsersModule,
    MongooseModule.forFeature([{ name: RefreshToken.name, schema: RefreshTokenSchema }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ...COMMAND_HANDLERS,
    {
      // A second JwtService instance, deliberately separate from the
      // globally-registered one (JWT_SECRET, access tokens) — refresh
      // tokens sign with JWT_REFRESH_SECRET and a much longer expiry, so
      // a leaked access-token secret can't be used to forge a refresh
      // token or vice versa.
      provide: REFRESH_JWT_SERVICE_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new JwtService({
          secret: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          signOptions: {
            expiresIn: configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d') as StringValue,
          },
        }),
    },
  ],
})
export class AuthModule {}
