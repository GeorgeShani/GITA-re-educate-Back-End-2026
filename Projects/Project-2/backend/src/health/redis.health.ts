import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';

// @nestjs/terminus ships a MongooseHealthIndicator but no Redis
// equivalent, so this is a small hand-rolled one following the same
// HealthIndicatorService pattern (Terminus v11 API). Keeps one
// long-lived lazy connection for pinging rather than reconnecting per
// health check.
@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private client?: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck<Key extends string = 'redis'>(key: Key) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      // ioredis types `.ping()` as resolving only to the literal 'PONG' —
      // a failed ping rejects rather than resolving with something else,
      // so the failure signal is the catch block, not a value check.
      await this.getClient().ping();
      return indicator.up();
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(
        this.configService.getOrThrow<string>('REDIS_URL'),
        {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        },
      );
    }
    return this.client;
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
