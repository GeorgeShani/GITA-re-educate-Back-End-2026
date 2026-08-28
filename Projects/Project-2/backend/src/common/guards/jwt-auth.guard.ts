import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthenticatedUser,
  RequestWithUser,
} from '@/common/interfaces/request-with-user.interface';
import { extractBearerToken } from '@/common/utils/extract-bearer-token.util';

// Hand-rolled guard, ported from Homework 25/26 rather than passport-jwt
// (SCOPE.md decision — fewer moving parts, code already understood).
// Extended with `role` in the verified payload so RolesGuard has
// something to check downstream.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<
        AuthenticatedUser & { sub: string }
      >(token);

      request.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }
}
