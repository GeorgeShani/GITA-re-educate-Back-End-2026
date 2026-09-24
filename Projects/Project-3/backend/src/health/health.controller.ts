import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '#/common/auth/public.decorator.js';

/**
 * `GET /health` — liveness AND readiness now that the database indicator is
 * here.
 *
 * Mounted at the root and deliberately unversioned: the Docker healthcheck and
 * any future platform probe expect it there, and `@nestjs/observe` is
 * configured to ignore it so healthchecks every 10s don't consume the
 * telemetry event budget.
 *
 * `@Public()` has no runtime effect yet — the global auth guard it's an
 * escape hatch for doesn't exist until Milestone 3 — but marking it now is
 * both accurate (health checks must stay public in the finished app) and
 * what `route-audit.spec.ts` checks against, so this route is provably
 * accounted for rather than un-annotated by omission.
 *
 * Deliberately has no `@ApiOkResponse` — its shape is Terminus's own dynamic
 * `HealthCheckResult`, an operational detail, not a domain response worth a
 * DTO. `route-audit.spec.ts`'s response-type check exempts it by name.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('postgres')]);
  }
}
