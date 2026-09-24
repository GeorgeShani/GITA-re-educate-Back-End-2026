import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { CompanyDto } from '../../companies/dto/company.dto.js';
import { UserProfileDto } from '../../users/dto/user-profile.dto.js';

export class MeDto {
  @ApiProperty({ type: () => UserProfileDto })
  @Expose()
  @Type(() => UserProfileDto)
  user!: UserProfileDto;

  @ApiProperty({ type: () => CompanyDto })
  @Expose()
  @Type(() => CompanyDto)
  company!: CompanyDto;
}
