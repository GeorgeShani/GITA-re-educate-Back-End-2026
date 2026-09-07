import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';

import { getProcessRole } from '@/common/utils/process-role.util';
import { RedisHealthIndicator } from './redis.health';

// Excluded from the /api/v1 prefix in main.ts — health checks are
// infrastructure, not versioned API surface. Stripe/Cloudinary indicators
// are added here as S6/S9 land (SCOPE.md Part D verification step 2).
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness/readiness check for MongoDB and Redis' })
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb'),
      () => this.redis.pingCheck('redis'),
      // Not a dependency check — it reports which half of the system this
      // process is running, so a deployment can be confirmed as api/worker
      // without shelling in.
      () =>
        Promise.resolve({
          role: { status: 'up' as const, role: getProcessRole() },
        }),
    ]);
  }
}
