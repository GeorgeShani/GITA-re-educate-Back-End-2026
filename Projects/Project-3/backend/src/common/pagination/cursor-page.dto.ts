import type { Type as ClassType } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CursorMetaDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `cursor` to get the next page; null on the last page.',
  })
  @Expose()
  nextCursor!: string | null;

  @ApiProperty()
  @Expose()
  hasMore!: boolean;
}

/**
 * `OffsetPageOf`'s counterpart for keyset-paginated lists: the `{ data, meta }`
 * envelope as a real, named class so the OpenAPI schema shows the item type and
 * `route-audit.spec.ts` has a `type` to check.
 *
 * ```ts
 * export class FilePageDto extends CursorPageOf(FileDto) {}
 * ```
 */
export function CursorPageOf<TItem extends object>(item: ClassType<TItem>) {
  class CursorPage {
    @ApiProperty({ type: [item] })
    @Expose()
    @Type(() => item)
    data!: TItem[];

    @ApiProperty({ type: () => CursorMetaDto })
    @Expose()
    @Type(() => CursorMetaDto)
    meta!: CursorMetaDto;
  }

  return CursorPage;
}
