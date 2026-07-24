import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class FindExpensesDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceTo?: number;
}
