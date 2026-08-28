import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { NewsletterLinkQueryDto } from './dto/newsletter-link-query.dto';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { NewsletterService } from './newsletter.service';

// No confirmation/unsubscribe email actually sends yet — no MJML
// template exists for either (S4 only shipped verify-email/
// reset-password) — so these three routes are the foundation S11's
// newsletter piece assumed would already exist, not a fully wired
// double-opt-in flow end to end.
@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Throttle(WRITE_THROTTLE)
  @Post('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Subscribe — confirmation is a separate step' })
  async subscribe(@Body() dto: SubscribeNewsletterDto): Promise<void> {
    await this.newsletterService.subscribe(dto.email);
  }

  @Get('confirm')
  @ApiOperation({ summary: 'Double opt-in confirmation link' })
  confirm(@Query() query: NewsletterLinkQueryDto) {
    return this.newsletterService.confirm(query.email, query.token);
  }

  @Get('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'One-click unsubscribe link — GET, same as confirm, so it works as a plain email link with no JS',
  })
  async unsubscribe(@Query() query: NewsletterLinkQueryDto): Promise<void> {
    await this.newsletterService.unsubscribe(query.email, query.token);
  }
}
