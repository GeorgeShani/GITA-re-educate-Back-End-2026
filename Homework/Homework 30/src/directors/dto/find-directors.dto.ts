import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindDirectorsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  birthYearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  birthYearTo?: number;
}
