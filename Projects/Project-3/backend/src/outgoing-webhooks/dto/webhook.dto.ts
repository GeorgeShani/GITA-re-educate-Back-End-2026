import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { OffsetPageOf } from '#/common/pagination/offset-page.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import { WebhookDelivery } from '../webhook-delivery.entity.js';
import { WebhookEndpoint } from '../webhook-endpoint.entity.js';
import {
  SUBSCRIBABLE_WEBHOOK_EVENTS,
  type SubscribableWebhookEvent,
} from '../webhook-events.js';

export class WebhookEndpointDto {
  @ApiProperty({ format: 'uuid' }) @Expose() id!: string;
  @ApiProperty() @Expose() name!: string;
  @ApiProperty({ format: 'uri' }) @Expose() url!: string;
  @ApiProperty({ enum: SUBSCRIBABLE_WEBHOOK_EVENTS, isArray: true })
  @Expose()
  events!: SubscribableWebhookEvent[];
  @ApiProperty() @Expose() active!: boolean;
  @ApiProperty() @Expose() consecutiveFailures!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  disabledAt!: Date | null;
  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  static from(row: WebhookEndpoint): WebhookEndpointDto {
    return toDto(WebhookEndpointDto, row);
  }
}

export class CreatedWebhookEndpointDto extends WebhookEndpointDto {
  @ApiProperty({ description: 'Shown once. Store it in the receiver now.' })
  @Expose()
  secret!: string;

  static fromCreated(
    row: WebhookEndpoint,
    secret: string,
  ): CreatedWebhookEndpointDto {
    return toDto(CreatedWebhookEndpointDto, { ...row, secret });
  }
}

export class RotatedWebhookSecretDto {
  @ApiProperty({ format: 'uuid' }) @Expose() id!: string;
  @ApiProperty({
    description: 'Shown once. The previous secret no longer signs deliveries.',
  })
  @Expose()
  secret!: string;
}

export class WebhookDeliveryDto {
  @ApiProperty({ format: 'uuid' }) @Expose() id!: string;
  @ApiProperty({ format: 'uuid' }) @Expose() eventId!: string;
  @ApiProperty() @Expose() eventType!: string;
  @ApiProperty({ enum: ['pending', 'succeeded', 'failed'] })
  @Expose()
  status!: string;
  @ApiProperty() @Expose() attempts!: number;
  @ApiProperty({ type: Number, nullable: true }) @Expose() responseStatus!:
    number | null;
  @ApiProperty({ type: String, nullable: true }) @Expose() lastError!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  deliveredAt!: Date | null;
  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  static from(row: WebhookDelivery): WebhookDeliveryDto {
    return toDto(WebhookDeliveryDto, row);
  }
}

export class WebhookEndpointPageDto extends OffsetPageOf(WebhookEndpointDto) {}
export class WebhookDeliveryPageDto extends OffsetPageOf(WebhookDeliveryDto) {}
