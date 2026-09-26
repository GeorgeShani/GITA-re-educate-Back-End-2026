import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PortalSessionDto {
  @ApiProperty({ format: 'uri' })
  @Expose()
  url!: string;
}
