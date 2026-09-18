import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import type { SortField } from '../common/sorting/sort-field.js';

class SortFieldDto implements SortField {
  @ApiProperty()
  @Expose()
  field!: string;

  @ApiProperty({ enum: ['ASC', 'DESC'] })
  @Expose()
  direction!: 'ASC' | 'DESC';
}

export class ProbeSortedResponseDto {
  @ApiProperty({ type: [SortFieldDto] })
  @Expose()
  @Type(() => SortFieldDto)
  sort!: SortFieldDto[];
}
