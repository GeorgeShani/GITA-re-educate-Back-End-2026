import { Injectable } from '@nestjs/common';
import { RequestContextService } from '../core/context/request-context.service.js';

/**
 * Temporary. Its only job is to make the Phase 1 gate provable, and it is also
 * the subject of the decorator-metadata canary spec — the constructor parameter
 * below is what `Reflect.getMetadata('design:paramtypes', ProbeService)` reads.
 *
 * Removed once real modules exist (Milestone 3).
 */
@Injectable()
export class ProbeService {
  constructor(private readonly context: RequestContextService) {}

  echo(n: number) {
    return {
      n,
      doubled: n * 2,
      correlationId: this.context.correlationId,
    };
  }
}
