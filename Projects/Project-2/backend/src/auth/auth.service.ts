import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { Role } from '../common/enums/role.enum';
import { RecordLoginCommand } from './commands/record-login.command';
import { RegisterUserCommand } from './commands/register-user.command';
import { RequestPasswordResetCommand } from './commands/request-password-reset.command';
import { ResetPasswordCommand } from './commands/reset-password.command';
import { VerifyEmailCommand } from './commands/verify-email.command';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { REFRESH_JWT_SERVICE_TOKEN } from './refresh-jwt.token';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';
import { hashToken } from './utils/token-hash.util';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';

const SALT_ROUNDS = 10;

interface RefreshJwtPayload {
  sub: string;
  jti: string;
  exp: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(REFRESH_JWT_SERVICE_TOKEN)
    private readonly refreshJwtService: JwtService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly cls: ClsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.commandBus.execute<
      RegisterUserCommand,
      UserDocument
    >(
      new RegisterUserCommand(
        dto.firstName,
        dto.lastName,
        dto.email,
        passwordHash,
        dto.phone,
        this.correlationId(),
      ),
    );
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.commandBus.execute(
      new RecordLoginCommand(user.id, this.correlationId()),
    );
    return this.issueTokens(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthResponseDto> {
    await this.verifyRefreshJwt(rawRefreshToken); // signature + expiry only; DB state is the source of truth below
    const stored = await this.refreshTokenModel.findOne({
      tokenHash: hashToken(rawRefreshToken),
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      // This exact token was already rotated away (or explicitly logged
      // out) and is being presented again — a stolen/replayed token is
      // the most likely explanation, so the whole session is nuked
      // rather than just this one token.
      await this.refreshTokenModel.updateMany(
        { userId: stored.userId, revokedAt: null },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException(
        'Refresh token reuse detected — please log in again',
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.usersService.findById(stored.userId.toString());
    const { refreshToken, doc: newDoc } = await this.createRefreshToken(
      user.id,
    );

    stored.revokedAt = new Date();
    stored.replacedByTokenId = newDoc._id;
    await stored.save();

    const accessToken = await this.signAccessToken(user);
    return { accessToken, refreshToken };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokenModel.updateOne(
      { tokenHash: hashToken(rawRefreshToken), revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    await this.commandBus.execute(
      new RequestPasswordResetCommand(dto.email, this.correlationId()),
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const newPasswordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.commandBus.execute(
      new ResetPasswordCommand(
        dto.token,
        newPasswordHash,
        this.correlationId(),
      ),
    );
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    await this.commandBus.execute(
      new VerifyEmailCommand(dto.token, this.correlationId()),
    );
  }

  private async issueTokens(user: UserDocument): Promise<AuthResponseDto> {
    const accessToken = await this.signAccessToken(user);
    const { refreshToken } = await this.createRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  private signAccessToken(user: UserDocument): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.roles[0] ?? Role.CUSTOMER,
    });
  }

  private async createRefreshToken(
    userId: string,
  ): Promise<{ refreshToken: string; doc: RefreshTokenDocument }> {
    const refreshToken = await this.refreshJwtService.signAsync({
      sub: userId,
      jti: crypto.randomUUID(),
    });
    const payload =
      this.refreshJwtService.decode<RefreshJwtPayload>(refreshToken);

    const doc = await this.refreshTokenModel.create({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(payload.exp * 1000),
    });

    return { refreshToken, doc };
  }

  private async verifyRefreshJwt(token: string): Promise<RefreshJwtPayload> {
    try {
      return await this.refreshJwtService.verifyAsync<RefreshJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
