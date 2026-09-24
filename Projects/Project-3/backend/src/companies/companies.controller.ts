import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '#/common/auth/roles.decorator.js';
import { CompaniesService } from './companies.service.js';
import { CompanyDto } from './dto/company.dto.js';
import { MemberDto } from './dto/member.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  /**
   * Any signed-in user. Deliberately a projection of `{ id, fullName }` only — see
   * `MemberDto` and decision D1 for why this exists beside the admin-only `GET /employees`.
   */
  @Roles('admin', 'employee')
  @Get('me/members')
  @ApiOkResponse({ type: MemberDto, isArray: true })
  async members(): Promise<MemberDto[]> {
    return (await this.companies.members()).map((user) => MemberDto.from(user));
  }

  @Roles('admin')
  @Patch('me')
  @ApiOkResponse({ type: CompanyDto })
  async updateMine(@Body() dto: UpdateCompanyDto): Promise<CompanyDto> {
    return CompanyDto.from(await this.companies.updateMine(dto));
  }
}
