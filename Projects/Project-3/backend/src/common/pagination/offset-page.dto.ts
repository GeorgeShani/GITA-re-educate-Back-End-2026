import type { Type as ClassType } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class OffsetMetaDto {
  @ApiProperty({ example: 1 })
  @Expose()
  page!: number;

  @ApiProperty({ example: 20 })
  @Expose()
  limit!: number;

  @ApiProperty({ description: 'Rows matching the filter across all pages.' })
  @Expose()
  total!: number;

  @ApiProperty()
  @Expose()
  totalPages!: number;
}

/**
 * The `{ data, meta }` envelope as a real, named class, so the OpenAPI schema
 * shows the actual item type instead of a bare array — and so
 * `route-audit.spec.ts`, which requires every response to name a DTO class,
 * has one to check. Use it as a base:
 *
 * ```ts
 * export class EmployeePageDto extends OffsetPageOf(EmployeeDto) {}
 * ```
 *
 * The subclass gives each page schema its own unique name (`EmployeePageDto`).
 * This is the "composed Swagger decorator" SCOPE.md sketches as
 * `@ApiPaginatedResponse`, done as a class factory because a plain
 * `@ApiOkResponse({ schema })` would carry no `type` for that audit to see.
 */
export function OffsetPageOf<TItem extends object>(item: ClassType<TItem>) {
  class OffsetPage {
    @ApiProperty({ type: [item] })
    @Expose()
    @Type(() => item)
    data!: TItem[];

    @ApiProperty({ type: () => OffsetMetaDto })
    @Expose()
    @Type(() => OffsetMetaDto)
    meta!: OffsetMetaDto;
  }

  return OffsetPage;
}
