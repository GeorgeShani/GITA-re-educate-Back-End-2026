import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedUser,
  RequestWithUser,
} from '../interfaces/request-with-user.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.user?.[data] : request.user;
  },
);
