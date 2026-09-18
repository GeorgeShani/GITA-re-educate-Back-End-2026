import { minutes, ThrottlerOptions } from '@nestjs/throttler';

export const WRITE_THROTTLE: Record<string, ThrottlerOptions> = {
  default: { limit: 5, ttl: minutes(1) },
};
