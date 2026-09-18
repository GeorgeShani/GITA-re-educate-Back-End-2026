import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { toUserModel } from '../users/users.mapper.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import { LoginInput } from './dto/login.input.js';
import { RegisterInput } from './dto/register.input.js';
import { AuthPayload } from './types/auth-payload.type.js';
import type { JwtPayload } from './types/auth-payload.type.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthPayload> {
    const user = await this.usersService.create(input);
    return this.buildAuthPayload(user);
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.usersService.comparePassword(input.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthPayload(user);
  }

  private buildAuthPayload(user: UserDocument): AuthPayload {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: toUserModel(user),
    };
  }
}
