import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

/**
 * `GET /health` — liveness.
 *
 * Mounted at the root and deliberately unversioned: the Docker healthcheck and
 * any future platform probe expect it there, and `@nestjs/observe` is configured
 * to ignore it so healthchecks every 10s don't consume the telemetry event
 * budget.
 *
 * Phase 2 adds a `TypeOrmHealthIndicator` here, at which point this becomes a
 * genuine readiness check too.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    // No indicators yet — an empty check still exercises Terminus's response
    // shape, so the contract doesn't change when the database indicator lands.
    return this.health.check([]);
  }
}
