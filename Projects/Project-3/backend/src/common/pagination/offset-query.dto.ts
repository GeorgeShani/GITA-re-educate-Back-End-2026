import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * `page`/`limit` — used by small, bounded lists where a dashboard wants real
 * page numbers: `GET /employees`, `GET /billing/invoices`, `GET /api-keys`
 * (see SCOPE.md's pagination contract). `@Type` is explicit because the
 * global `ValidationPipe` deliberately does not enable
 * `enableImplicitConversion`.
 */
export class OffsetQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
