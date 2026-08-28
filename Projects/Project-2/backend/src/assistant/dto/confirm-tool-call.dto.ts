import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ConfirmToolCallDto {
  @ApiProperty({
    description:
      'true to actually run the pending mutating tool call(s), false to decline',
  })
  @IsBoolean()
  approve!: boolean;
}
