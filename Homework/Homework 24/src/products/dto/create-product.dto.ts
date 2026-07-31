import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
} from 'class-validator';
import { ProductCategory } from '../enums/product-category.enum';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @Type(() => Number)
  @IsPositive()
  price!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity!: number;
}
