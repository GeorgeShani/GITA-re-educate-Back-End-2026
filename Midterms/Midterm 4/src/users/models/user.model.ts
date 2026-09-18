import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('User')
export class UserModel {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
