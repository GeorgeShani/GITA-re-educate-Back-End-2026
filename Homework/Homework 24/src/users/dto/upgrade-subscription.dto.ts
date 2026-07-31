import { IsEmail } from 'class-validator';

export class UpgradeSubscriptionDto {
  @IsEmail()
  email!: string;
}
