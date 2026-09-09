import type { Request } from 'express';

export interface RequestWithSubscription extends Request {
  hasActiveSubscription?: boolean;
}
