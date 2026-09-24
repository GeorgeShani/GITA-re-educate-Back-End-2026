import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '#/common/auth/roles.decorator.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import { EmployeeDto, EmployeePageDto } from './dto/employee.dto.js';
import { EmployeesQueryDto } from './dto/employees-query.dto.js';
import { InviteEmployeeDto } from './dto/invite-employee.dto.js';
import { EmployeesService } from './employees.service.js';

/**
 * Management is admin-only — an employee gets 403 on every verb here. The list of
 * colleagues an employee IS allowed to see is `GET /companies/me/members`, which
 * returns names and ids only (decision D1).
 */
@ApiTags('employees')
@ApiBearerAuth()
@RequiresSubscription()
@Roles('admin')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  @ApiCreatedResponse({ type: EmployeeDto })
  async invite(@Body() dto: InviteEmployeeDto): Promise<EmployeeDto> {
    return EmployeeDto.from(await this.employees.invite(dto));
  }

  @Get()
  @ApiOkResponse({ type: EmployeePageDto })
  async list(@Query() query: EmployeesQueryDto): Promise<EmployeePageDto> {
    return toDto(EmployeePageDto, mapPageData(await this.employees.list(query), EmployeeDto.from));
  }

  @Post(':id/resend-invite')
  @HttpCode(200)
  @ApiOkResponse({ type: EmployeeDto })
  async resendInvite(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeDto> {
    return EmployeeDto.from(await this.employees.resendInvite(id));
  }

  @Delete(':id')
  @ApiOkResponse({ type: EmployeeDto })
  async disable(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeDto> {
    return EmployeeDto.from(await this.employees.disable(id));
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @ApiOkResponse({ type: EmployeeDto })
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeDto> {
    return EmployeeDto.from(await this.employees.reactivate(id));
  }
}
