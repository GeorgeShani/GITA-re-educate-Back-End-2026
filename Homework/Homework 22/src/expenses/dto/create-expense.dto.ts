import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
} from 'class-validator';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsPositive()
  price!: number;
}
