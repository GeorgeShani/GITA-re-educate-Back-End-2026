import { Gender } from '../entities/user.entity';

export class CreateUserDto {
  firstName!: string;
  lastName!: string;
  email!: string;
  phoneNumber!: string;
  gender!: Gender;
}
