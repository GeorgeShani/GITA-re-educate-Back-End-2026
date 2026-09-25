import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { CursorPageOf } from '#/common/pagination/cursor-page.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import { NOTIFICATION_TYPES } from '../notification-content.js';
import type { NotificationView } from '../notification-view.js';

export class NotificationDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES, description: 'What happened. Decides the shape of `payload`.' })
  @Expose()
  type!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Ids, counts and names for this `type` — never cell values. For `quota.threshold`: `threshold`, `plan`, ' +
      '`filesUsed`, `filesLimit`, `upgradeTo`. For `report.ready`/`report.failed`: `fileId`, `fileName`. For ' +
      '`file.shared`: `fileId`, `fileName`, `sharedByUserId`. For `invoice.finalized`: `invoiceId`, `totalCents`.',
  })
  @Expose()
  payload!: unknown;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Null while unread.' })
  @Expose()
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  static from(view: NotificationView): NotificationDto {
    return toDto(NotificationDto, view);
  }
}

export class NotificationPageDto extends CursorPageOf(NotificationDto) {}

export class UnreadCountDto {
  @ApiProperty({ description: 'How many of your notifications are unread.' })
  @Expose()
  count!: number;
}

export class MarkedReadDto {
  @ApiProperty({ description: 'How many notifications this call marked as read.' })
  @Expose()
  updated!: number;
}
