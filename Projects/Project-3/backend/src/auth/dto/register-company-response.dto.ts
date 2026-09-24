import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RegisterCompanyResponseDto {
  @ApiProperty()
  @Expose()
  companyId!: string;

  @ApiProperty()
  @Expose()
  userId!: string;

  @ApiProperty({ example: 'pending_activation' })
  @Expose()
  status!: 'pending_activation';

  @ApiProperty({ example: 'Check your inbox to activate your account.' })
  @Expose()
  message!: string;
}
