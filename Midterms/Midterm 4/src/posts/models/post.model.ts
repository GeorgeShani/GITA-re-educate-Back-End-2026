import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Post')
export class PostModel {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  content: string;

  @Field(() => ID)
  authorId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
