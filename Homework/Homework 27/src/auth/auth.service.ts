import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { password, ...rest } = registerDto;
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.usersService.create({
      ...rest,
      password: hashedPassword,
    });

    return this.buildAuthResponse(user.id, user.email);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user.id, user.email);
  }

  getCurrentUser(userId: string) {
    return this.usersService.findOne(userId);
  }

  private async buildAuthResponse(userId: string, email: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      email,
    });

    return { accessToken };
  }
}
