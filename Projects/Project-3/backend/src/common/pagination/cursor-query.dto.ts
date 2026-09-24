import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * `cursor`/`limit` — used by append-only, potentially large, time-ordered
 * lists: `GET /files`, `GET /audit` (see SCOPE.md's pagination contract).
 * `cursor` is validated as a non-empty string here only; decoding it into a
 * `Cursor` (and rejecting a malformed one) happens in `decodeCursor()`,
 * where the actual encoding format lives.
 */
export class CursorQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque; take it from `meta.nextCursor` of the previous page.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
