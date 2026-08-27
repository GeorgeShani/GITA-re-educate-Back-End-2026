import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    description:
      'Marketing/opt-in email. Transactional, security, and ops email are always sent regardless of this setting.',
  })
  @IsBoolean()
  marketingOptIn!: boolean;
}
