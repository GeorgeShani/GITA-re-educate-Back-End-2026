import { IsString, MinLength } from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto';

export class RegisterDto extends CreateUserDto {
  @IsString()
  @MinLength(6)
  password!: string;
}
