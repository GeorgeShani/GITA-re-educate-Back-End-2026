import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ProductCategory } from '../enums/product-category.enum';

export class FindProductsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;
}
