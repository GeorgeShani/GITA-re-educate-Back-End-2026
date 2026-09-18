import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;
}
