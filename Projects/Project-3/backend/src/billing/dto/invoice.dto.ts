import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { OffsetPageOf } from '#/common/pagination/offset-page.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import { PLANS, type Plan } from '#/subscriptions/plan-catalog.js';
import { parseLineItems } from '../line-item.schema.js';
import { INVOICE_STATUSES, type Invoice, type InvoiceStatus } from '../invoice.entity.js';
import { LineItemDto } from './statement.dto.js';

/** A finalized invoice. Immutable: what it says now is what it said when it was issued. */
export class InvoiceDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ enum: PLANS, description: 'The plan that was live during the billed period.' })
  @Expose()
  plan!: Plan;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  periodStart!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Exclusive. Earlier than the period end when a plan change closed the period early.',
  })
  @Expose()
  periodEnd!: Date;

  @ApiProperty({ type: () => [LineItemDto] })
  @Expose()
  @Type(() => LineItemDto)
  lineItems!: LineItemDto[];

  @ApiProperty({ description: 'Integer cents.' })
  @Expose()
  totalCents!: number;

  @ApiProperty({ enum: INVOICE_STATUSES })
  @Expose()
  status!: InvoiceStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  dueDate!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  /** `lineItems` is `jsonb`; it is parsed, never trusted, on its way out. */
  static from(invoice: Invoice): InvoiceDto {
    return toDto(InvoiceDto, { ...invoice, lineItems: parseLineItems(invoice.lineItems) });
  }
}

export class InvoicePageDto extends OffsetPageOf(InvoiceDto) {}
