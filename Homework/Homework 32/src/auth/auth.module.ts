import { Module } from '@nestjs/common';
import { EmailSenderModule } from '../email-sender/email-sender.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule, EmailSenderModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
