import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { SortField } from './sort-field.js';

/**
 * Turns a raw `?sort=-createdAt,fileName` query string into `SortField[]`,
 * validated against a whitelist — never wider than the indexed columns, so
 * `?sort=-createdAt` is fine and `?sort=secret` is a 400, not a slow query.
 *
 * The whitelist is a CONSTRUCTOR argument, not a `@SortableFields()` route
 * decorator as originally sketched in AGENTS.md — verified against
 * `@nestjs/common`'s own types: a `PipeTransform` receives only
 * `ArgumentMetadata` (`{ type, metatype, data }`), with no access to the
 * controller class or method, so it cannot read metadata a decorator set on
 * the route handler. A constructor argument is the correct, idiomatic Nest
 * pattern here (see `ParseIntPipe`/`ParseUUIDPipe`'s own options objects) —
 * it also makes this trivially unit-testable with no `ExecutionContext` to
 * mock. Usage: `@Query('sort', new ParseSortPipe(FILE_SORT_FIELDS)) sort: SortField[]`.
 */
@Injectable()
export class ParseSortPipe implements PipeTransform<unknown, SortField[]> {
  constructor(private readonly allowedFields: readonly string[]) {}

  transform(value: unknown): SortField[] {
    if (value === undefined || value === null || value === '') return [];

    const raw = Array.isArray(value) ? value.join(',') : String(value);
    return raw
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .map((token) => this.parseToken(token));
  }

  private parseToken(token: string): SortField {
    const descending = token.startsWith('-');
    const field = descending ? token.slice(1) : token;

    if (!this.allowedFields.includes(field)) {
      throw new BadRequestException(
        `Cannot sort by "${field}". Allowed fields: ${this.allowedFields.join(', ')}`,
      );
    }

    return { field, direction: descending ? 'DESC' : 'ASC' };
  }
}
