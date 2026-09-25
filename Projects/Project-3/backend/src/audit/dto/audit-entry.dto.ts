import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { CursorPageOf } from '#/common/pagination/cursor-page.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import { AUDIT_ACTIONS, type AuditAction } from '#/core/audit/audit-actions.js';
import type { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';

/**
 * A row in the audit list. `metadata` is deliberately NOT here: it can carry details
 * (an invited email address, a file name) that a list of thousands should not haul
 * around. It loads only on the single-entry read.
 */
export class AuditEntryDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ enum: AUDIT_ACTIONS, description: 'What happened, `<area>.<what_happened>`.' })
  @Expose()
  action!: AuditAction;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Who did it. Null for the system (the billing cycle) or a person since removed.',
  })
  @Expose()
  actorUserId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'file' })
  @Expose()
  targetType!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The id of what it happened to.' })
  @Expose()
  targetId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The caller’s IP address, when it came over HTTP.' })
  @Expose()
  ip!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Ties entries written by one request together, and to that request’s logs.',
  })
  @Expose()
  correlationId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  static from(entry: AuditLogEntry): AuditEntryDto {
    return toDto(AuditEntryDto, entry);
  }
}

export class AuditEntryDetailDto extends AuditEntryDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Details specific to the action (for example the plan changed to, or the name of a file).',
  })
  @Expose()
  metadata!: Record<string, unknown>;

  static override from(entry: AuditLogEntry): AuditEntryDetailDto {
    return toDto(AuditEntryDetailDto, entry);
  }
}

export class AuditPageDto extends CursorPageOf(AuditEntryDto) {}
