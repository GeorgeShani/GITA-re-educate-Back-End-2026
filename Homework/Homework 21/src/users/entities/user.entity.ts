export type Gender = 'male' | 'female';

export class User {
  id!: number;
  firstName!: string;
  lastName!: string;
  email!: string;
  phoneNumber!: string;
  gender!: Gender;
}
