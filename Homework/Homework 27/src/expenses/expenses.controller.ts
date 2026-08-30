import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { FindExpensesDto } from './dto/find-expenses.dto';
import { TopSpendersDto } from './dto/top-spenders.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Throttle(WRITE_THROTTLE)
  @Post()
  create(
    @Body() createExpenseDto: CreateExpenseDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.expensesService.create(createExpenseDto, userId);
  }

  @Get()
  findAll(@Query() query: FindExpensesDto) {
    return this.expensesService.findAll(query);
  }

  @Get('statistic')
  getStatistic() {
    return this.expensesService.getCategoryStatistics();
  }

  @Get('top-spenders')
  getTopSpenders(@Query() { limit = 10 }: TopSpendersDto) {
    return this.expensesService.getTopSpenders(limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.expensesService.findOne(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.expensesService.update(id, updateExpenseDto, userId);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.expensesService.remove(id, userId);
  }
}
