import type { Request } from 'express';

export interface AuthenticatedUser {
  userId: number;
  email: string;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
