import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { USER_EMAIL_HEADER } from '../constants/headers.constant';
import type { RequestWithSubscription } from '../interfaces/request-with-subscription.interface';
import { UsersService } from '../../users/users.service';

@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithSubscription>();

    const emailHeader = request.headers[USER_EMAIL_HEADER];
    const email = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader;

    request.hasActiveSubscription = Boolean(
      email && (await this.usersService.isSubscriptionActive(email)),
    );

    return true;
  }
}
