import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { RequestUser } from '../types/auth-payload.type.js';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): RequestUser => {
  const ctx = GqlExecutionContext.create(context);
  return ctx.getContext().req.user;
});
