import { Field, ObjectType } from '@nestjs/graphql';
import { UserModel } from '../../users/models/user.model.js';

@ObjectType('AuthPayload')
export class AuthPayload {
  @Field()
  accessToken: string;

  @Field(() => UserModel)
  user: UserModel;
}

export interface JwtPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface RequestUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}
