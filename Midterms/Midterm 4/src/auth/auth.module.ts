import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthResolver } from './auth.resolver.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Global()
@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: Number(configService.get<string>('JWT_EXPIRES_IN', '86400')) },
      }),
    }),
  ],
  providers: [AuthService, AuthResolver, JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
