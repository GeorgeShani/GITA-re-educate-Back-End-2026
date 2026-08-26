import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { QueryUsersDto } from './dto/query-users.dto';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get('total-users')
  countAll() {
    return this.usersService.countAll();
  }
}
