import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreatePostInput {
  @Field()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @Field()
  @IsString()
  @MinLength(1)
  content: string;
}
