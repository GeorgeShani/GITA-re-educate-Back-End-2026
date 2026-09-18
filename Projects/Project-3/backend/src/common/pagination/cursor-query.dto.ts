import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * `cursor`/`limit` — used by append-only, potentially large, time-ordered
 * lists: `GET /files`, `GET /audit` (see SCOPE.md's pagination contract).
 * `cursor` is validated as a non-empty string here only; decoding it into a
 * `Cursor` (and rejecting a malformed one) happens in `decodeCursor()`,
 * where the actual encoding format lives.
 */
export class CursorQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
