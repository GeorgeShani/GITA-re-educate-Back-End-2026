import { PickType } from '@nestjs/mapped-types';
import { VerifyOtpDto } from './verify-otp.dto';

export class ResendOtpDto extends PickType(VerifyOtpDto, ['email']) {}
