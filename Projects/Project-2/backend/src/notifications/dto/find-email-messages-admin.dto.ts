import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import type {
  EmailCategory,
  EmailStatus,
} from '@/notifications/schemas/email-message.schema';

const EMAIL_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
  'failed',
] as const;
const EMAIL_CATEGORIES = [
  'transactional',
  'security',
  'ops',
  'marketing',
  'opt-in',
] as const;

export class FindEmailMessagesAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EMAIL_STATUSES })
  @IsOptional()
  @IsIn(EMAIL_STATUSES)
  status?: EmailStatus;

  @ApiPropertyOptional({ enum: EMAIL_CATEGORIES })
  @IsOptional()
  @IsIn(EMAIL_CATEGORIES)
  category?: EmailCategory;

  @ApiPropertyOptional({ description: 'Case-insensitive partial match' })
  @IsOptional()
  @IsString()
  to?: string;
}
