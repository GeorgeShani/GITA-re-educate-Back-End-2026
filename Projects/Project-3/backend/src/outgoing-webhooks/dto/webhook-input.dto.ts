import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SUBSCRIBABLE_WEBHOOK_EVENTS,
  type SubscribableWebhookEvent,
} from '../webhook-events.js';

export class CreateWebhookEndpointDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ format: 'uri', maxLength: 2048 })
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ enum: SUBSCRIBABLE_WEBHOOK_EVENTS, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(SUBSCRIBABLE_WEBHOOK_EVENTS.length)
  @IsIn(SUBSCRIBABLE_WEBHOOK_EVENTS, { each: true })
  events!: SubscribableWebhookEvent[];
}

export class UpdateWebhookEndpointDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ format: 'uri', maxLength: 2048 })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional({ enum: SUBSCRIBABLE_WEBHOOK_EVENTS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(SUBSCRIBABLE_WEBHOOK_EVENTS.length)
  @IsIn(SUBSCRIBABLE_WEBHOOK_EVENTS, { each: true })
  events?: SubscribableWebhookEvent[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
