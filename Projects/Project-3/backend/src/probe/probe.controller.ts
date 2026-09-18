import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth/public.decorator.js';
import { ParseSortPipe } from '../common/sorting/parse-sort.pipe.js';
import type { SortField } from '../common/sorting/sort-field.js';
import { toDto } from '../common/response/to-dto.js';
import { ProbeEchoResponseDto } from './probe-echo-response.dto.js';
import { ProbeSortedResponseDto } from './probe-sorted-response.dto.js';
import { ProbeQueryDto } from './probe.dto.js';
import { ProbeService } from './probe.service.js';

/** The whitelist a real resource would derive from its indexed columns. */
const PROBE_SORTABLE_FIELDS = ['n', 'createdAt'] as const;

/**
 * Temporary smoke-test surface for the Phase 1, 3 and 4 gates.
 * Underscore-prefixed so it reads as internal, and removed once real modules
 * land. Included in `route-audit.spec.ts` and given full Swagger annotations
 * anyway — annotating temporary scaffolding costs nothing and keeps those
 * audits meaningful over every current route rather than a subset.
 */
@ApiTags('probe')
@Controller('_probe')
export class ProbeController {
  constructor(private readonly probe: ProbeService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: ProbeEchoResponseDto })
  echo(@Query() query: ProbeQueryDto): ProbeEchoResponseDto {
    return toDto(ProbeEchoResponseDto, this.probe.echo(query.n));
  }

  /**
   * Proves `ParseSortPipe` end to end through real HTTP and the real global
   * `ValidationPipe`/`AllExceptionsFilter` — not just the pipe's own unit
   * tests. `?sort=-n` -> 200; `?sort=secret` -> 400 in the error envelope.
   */
  @Public()
  @Get('sorted')
  @ApiOkResponse({ type: ProbeSortedResponseDto })
  sorted(
    @Query('sort', new ParseSortPipe(PROBE_SORTABLE_FIELDS)) sort: SortField[],
  ): ProbeSortedResponseDto {
    return toDto(ProbeSortedResponseDto, { sort });
  }
}
