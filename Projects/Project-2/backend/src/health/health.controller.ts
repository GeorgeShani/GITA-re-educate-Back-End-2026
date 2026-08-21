import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';

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
    ]);
  }
}
