import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmailSenderService } from '../email-sender/email-sender.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailSenderService: EmailSenderService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { password, ...rest } = registerDto;
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.usersService.create({
      ...rest,
      password: hashedPassword,
    });

    const otpCode = generateOtpCode();
    await this.usersService.setOtp(user.id, otpCode, otpExpiryDate());
    await this.emailSenderService.sendOtpEmail(user.email, otpCode);

    return { message: 'Registered. Check your email for a verification code.' };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Account not verified. Check your email for a verification code.',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    return this.buildAuthResponse(user.id, user.email);
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const user = await this.usersService.findByEmailWithOtp(verifyOtpDto.email);

    if (!user) {
      throw new NotFoundException(
        `User with email ${verifyOtpDto.email} not found`,
      );
    }

    if (user.isVerified) {
      throw new BadRequestException('Account is already verified');
    }

    if (!user.otpCode || user.otpCode !== verifyOtpDto.otpCode) {
      throw new BadRequestException('Invalid verification code');
    }

    if (
      !user.otpCodeExpiresAt ||
      user.otpCodeExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Verification code has expired');
    }

    await this.usersService.markVerified(user.id);
    await this.emailSenderService.sendWelcomeEmail(user.email, user.firstName);

    return this.buildAuthResponse(user.id, user.email);
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const user = await this.usersService.findByEmail(resendOtpDto.email);

    if (!user) {
      throw new NotFoundException(
        `User with email ${resendOtpDto.email} not found`,
      );
    }

    if (user.isVerified) {
      throw new BadRequestException('Account is already verified');
    }

    const otpCode = generateOtpCode();
    await this.usersService.setOtp(user.id, otpCode, otpExpiryDate());
    await this.emailSenderService.sendOtpEmail(user.email, otpCode);

    return { message: 'A new verification code has been sent' };
  }

  getCurrentUser(userId: number) {
    return this.usersService.findOne(userId);
  }

  private async buildAuthResponse(userId: number, email: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      email,
    });

    return { accessToken };
  }
}

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpExpiryDate(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}
