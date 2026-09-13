import { Controller, Get, Query } from '@nestjs/common';
import { ProbeQueryDto } from './probe.dto.js';
import { ProbeService } from './probe.service.js';

/**
 * Temporary smoke-test surface for the Phase 1 gate. Underscore-prefixed so it
 * reads as internal, and removed once real modules land.
 */
@Controller('_probe')
export class ProbeController {
  constructor(private readonly probe: ProbeService) {}

  @Get()
  echo(@Query() query: ProbeQueryDto) {
    return this.probe.echo(query.n);
  }
}
