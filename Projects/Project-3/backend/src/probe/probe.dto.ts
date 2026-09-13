import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Exists to give the Phase 1 gate something real to validate. `@Type` is
 * explicit because the global ValidationPipe deliberately does not enable
 * `enableImplicitConversion` — see CoreModule.
 */
export class ProbeQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'n must be an integer' })
  @Min(1)
  @Max(100)
  n!: number;
}
