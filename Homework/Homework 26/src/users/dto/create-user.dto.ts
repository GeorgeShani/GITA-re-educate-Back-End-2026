import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Gender } from '../enums/gender.enum';

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

  @IsEnum(Gender)
  gender!: Gender;
}
