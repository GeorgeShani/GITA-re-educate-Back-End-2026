import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthenticatedUser,
  RequestWithUser,
} from '@/common/interfaces/request-with-user.interface';
import { extractBearerToken } from '@/common/utils/extract-bearer-token.util';

// For routes that behave for both guests and authenticated users (S8's
// cart endpoints) — populates request.user when a valid token is
// present, but never rejects the request for a missing or invalid one.
// Unlike JwtAuthGuard, an expired/malformed token here just means the
// caller is treated as a guest rather than a 401.
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);

    if (!token) {
      return true;
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
      // Invalid/expired token on an optional-auth route — proceed as a guest.
    }

    return true;
  }
}
