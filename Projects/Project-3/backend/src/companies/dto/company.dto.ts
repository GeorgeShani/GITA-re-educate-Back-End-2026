import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { toDto } from '#/common/response/to-dto.js';
import {
  COMPANY_INDUSTRIES,
  COMPANY_STATUSES,
  type Company,
  type CompanyIndustry,
  type CompanyStatus,
} from '#/database/entities/company.entity.js';

export class CompanyDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ description: 'Where invoices and account notices go.' })
  @Expose()
  billingEmail!: string;

  @ApiProperty({ example: 'GE' })
  @Expose()
  country!: string;

  @ApiProperty({ enum: COMPANY_INDUSTRIES })
  @Expose()
  industry!: CompanyIndustry;

  @ApiProperty({ enum: COMPANY_STATUSES })
  @Expose()
  status!: CompanyStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  activatedAt!: Date | null;

  @ApiProperty({
    description:
      'True for the seeded read-only demo company, where every write is refused. A client can use it to show a demo banner.',
  })
  @Expose()
  isDemo!: boolean;

  static from(company: Company): CompanyDto {
    return toDto(CompanyDto, company);
  }
}
