import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdatePostInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;
}
