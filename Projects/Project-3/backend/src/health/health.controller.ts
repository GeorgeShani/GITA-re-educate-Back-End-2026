import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

/**
 * `GET /health` — liveness AND readiness now that the database indicator is
 * here.
 *
 * Mounted at the root and deliberately unversioned: the Docker healthcheck and
 * any future platform probe expect it there, and `@nestjs/observe` is
 * configured to ignore it so healthchecks every 10s don't consume the
 * telemetry event budget.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('postgres')]);
  }
}
