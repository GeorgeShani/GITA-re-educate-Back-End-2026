import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard.js';
import type { RequestUser } from '../auth/types/auth-payload.type.js';
import { UserModel } from './models/user.model.js';
import { toUserModel } from './users.mapper.js';
import { UsersService } from './users.service.js';

@Resolver(() => UserModel)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => UserModel)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() currentUser: RequestUser): Promise<UserModel> {
    const user = await this.usersService.findById(currentUser.userId);
    return toUserModel(user);
  }
}
