import { Body, Controller, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '#/common/auth/roles.decorator.js';
import { CompaniesService } from './companies.service.js';
import { CompanyDto } from './dto/company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Roles('admin')
  @Patch('me')
  @ApiOkResponse({ type: CompanyDto })
  async updateMine(@Body() dto: UpdateCompanyDto): Promise<CompanyDto> {
    return CompanyDto.from(await this.companies.updateMine(dto));
  }
}
