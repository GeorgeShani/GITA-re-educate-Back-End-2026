import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  age?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ageFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ageTo?: number;

  @IsOptional()
  @IsIn(['m', 'f'])
  gender?: 'm' | 'f';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
