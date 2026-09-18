import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Exists to prove the DTO -> OpenAPI -> openapi-typescript chain end to end
 * on a throwaway route before any real feature depends on it — see
 * SCOPE.md's risk register. `openapi.d.ts.spec.ts` asserts this specific
 * response type is not `unknown`, which is exactly what an undocumented
 * response schema would generate.
 */
export class ProbeEchoResponseDto {
  @ApiProperty()
  @Expose()
  n!: number;

  @ApiProperty()
  @Expose()
  doubled!: number;

  @ApiProperty({ required: false })
  @Expose()
  correlationId?: string;
}
