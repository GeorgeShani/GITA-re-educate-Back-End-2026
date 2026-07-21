import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsPositive()
  price!: number;
}
