import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedUser,
  RequestWithUser,
} from '../interfaces/request-with-user.interface';

// Ported verbatim from Homework 25/26. Usage: @CurrentUser() for the
// whole user, or @CurrentUser('userId') for a single field — this is the
// *only* sanctioned way a handler learns who's calling (SCOPE.md's
// security invariant for the assistant tools leans on this same pattern:
// resolve identity from the authenticated request, never from payload).
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.user?.[data] : request.user;
  },
);
