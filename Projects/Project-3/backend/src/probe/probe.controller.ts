import { Controller, Get, Query } from '@nestjs/common';
import { ParseSortPipe } from '../common/sorting/parse-sort.pipe.js';
import type { SortField } from '../common/sorting/sort-field.js';
import { ProbeQueryDto } from './probe.dto.js';
import { ProbeService } from './probe.service.js';

/** The whitelist a real resource would derive from its indexed columns. */
const PROBE_SORTABLE_FIELDS = ['n', 'createdAt'] as const;

/**
 * Temporary smoke-test surface for the Phase 1 and 3 gates. Underscore-prefixed
 * so it reads as internal, and removed once real modules land.
 */
@Controller('_probe')
export class ProbeController {
  constructor(private readonly probe: ProbeService) {}

  @Get()
  echo(@Query() query: ProbeQueryDto) {
    return this.probe.echo(query.n);
  }

  /**
   * Proves `ParseSortPipe` end to end through real HTTP and the real global
   * `ValidationPipe`/`AllExceptionsFilter` — not just the pipe's own unit
   * tests. `?sort=-n` -> 200; `?sort=secret` -> 400 in the error envelope.
   */
  @Get('sorted')
  sorted(
    @Query('sort', new ParseSortPipe(PROBE_SORTABLE_FIELDS)) sort: SortField[],
  ) {
    return { sort };
  }
}
