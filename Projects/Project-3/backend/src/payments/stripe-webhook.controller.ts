import { BadRequestException, Controller, Headers, HttpCode, Post, RawBody } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '#/common/auth/public.decorator.js';
import { toDto } from '#/common/response/to-dto.js';
import { StripeWebhookDto } from './dto/stripe-webhook.dto.js';
import { StripeWebhookService } from './stripe-webhook.service.js';

@ApiTags('webhooks')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly webhooks: StripeWebhookService) {}

  @Public()
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: StripeWebhookDto })
  async receive(
    @RawBody() rawBody: Buffer | undefined,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<StripeWebhookDto> {
    if (!rawBody || !signature) throw new BadRequestException('Stripe signature and raw body are required.');
    const result = await this.webhooks.handle(rawBody, signature);
    return toDto(StripeWebhookDto, { received: true, ...result });
  }
}
