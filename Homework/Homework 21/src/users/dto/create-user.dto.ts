import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { Gender } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsIn(['male', 'female'])
  gender!: Gender;
}
