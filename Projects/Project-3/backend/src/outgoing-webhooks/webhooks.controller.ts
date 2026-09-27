import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '#/common/auth/roles.decorator.js';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import {
  CreateWebhookEndpointDto,
  UpdateWebhookEndpointDto,
} from './dto/webhook-input.dto.js';
import {
  CreatedWebhookEndpointDto,
  RotatedWebhookSecretDto,
  WebhookDeliveryDto,
  WebhookDeliveryPageDto,
  WebhookEndpointDto,
  WebhookEndpointPageDto,
} from './dto/webhook.dto.js';
import { WebhooksService } from './webhooks.service.js';

@ApiTags('outgoing-webhooks')
@ApiBearerAuth()
@Roles('admin')
@RequiresSubscription()
@Controller('outgoing-webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  @ApiCreatedResponse({ type: CreatedWebhookEndpointDto })
  async create(
    @Body() dto: CreateWebhookEndpointDto,
  ): Promise<CreatedWebhookEndpointDto> {
    const created = await this.webhooks.create(dto);
    return CreatedWebhookEndpointDto.fromCreated(
      created.endpoint,
      created.secret,
    );
  }

  @Get()
  @ApiOkResponse({ type: WebhookEndpointPageDto })
  async list(@Query() query: OffsetQueryDto): Promise<WebhookEndpointPageDto> {
    return toDto(
      WebhookEndpointPageDto,
      mapPageData(await this.webhooks.list(query), WebhookEndpointDto.from),
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: WebhookEndpointDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ): Promise<WebhookEndpointDto> {
    return WebhookEndpointDto.from(await this.webhooks.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOkResponse({ type: WebhookEndpointDto })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebhookEndpointDto> {
    return WebhookEndpointDto.from(await this.webhooks.remove(id));
  }

  @Post(':id/rotate-secret')
  @HttpCode(200)
  @ApiOkResponse({ type: RotatedWebhookSecretDto })
  async rotateSecret(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RotatedWebhookSecretDto> {
    return toDto(RotatedWebhookSecretDto, await this.webhooks.rotateSecret(id));
  }

  @Post(':id/ping')
  @HttpCode(202)
  @ApiOkResponse({ type: WebhookDeliveryDto })
  async ping(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebhookDeliveryDto> {
    return WebhookDeliveryDto.from(await this.webhooks.ping(id));
  }

  @Get(':id/deliveries')
  @ApiOkResponse({ type: WebhookDeliveryPageDto })
  async deliveries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: OffsetQueryDto,
  ): Promise<WebhookDeliveryPageDto> {
    return toDto(
      WebhookDeliveryPageDto,
      mapPageData(
        await this.webhooks.deliveries(id, query),
        WebhookDeliveryDto.from,
      ),
    );
  }

  @Post('deliveries/:deliveryId/redeliver')
  @HttpCode(202)
  @ApiOkResponse({ type: WebhookDeliveryDto })
  async redeliver(
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ): Promise<WebhookDeliveryDto> {
    return WebhookDeliveryDto.from(await this.webhooks.redeliver(deliveryId));
  }
}
