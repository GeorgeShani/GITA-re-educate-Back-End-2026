import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiExcludeController } from '@nestjs/swagger';
import { Model } from 'mongoose';
import type { Request } from 'express';

import {
  EmailMessage,
  EmailMessageDocument,
  EmailStatus,
} from './schemas/email-message.schema';
import {
  EmailSuppression,
  EmailSuppressionDocument,
} from './schemas/email-suppression.schema';
import { MAIL_PROVIDER_TOKEN } from './mail/mail-provider.interface';
import type { MailProvider } from './mail/mail-provider.interface';

interface ResendWebhookPayload {
  type: string;
  data: { email_id: string };
}

const STATUS_BY_EVENT_TYPE: Record<string, EmailStatus> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

// Excluded from Swagger — not a client-facing API surface, and its
// contract is dictated by Resend, not by us. SCOPE.md B4: hard bounces
// and complaints insert into EmailSuppression automatically here; that's
// the entire reason this endpoint exists rather than polling Resend.
@ApiExcludeController()
@Controller('notifications/webhooks/resend')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    @InjectModel(EmailMessage.name)
    private readonly emailMessageModel: Model<EmailMessageDocument>,
    @InjectModel(EmailSuppression.name)
    private readonly emailSuppressionModel: Model<EmailSuppressionDocument>,
    @Inject(MAIL_PROVIDER_TOKEN) private readonly mailProvider: MailProvider,
  ) {}

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | undefined>,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }

    let isValid: boolean;
    try {
      isValid = this.mailProvider.verifyWebhook(rawBody, headers);
    } catch {
      throw new BadRequestException(
        'This mail provider does not support webhooks',
      );
    }
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // JSON.parse returns `any` — no cast needed, this annotation alone
    // gives TS everything it needs.
    const payload: ResendWebhookPayload = JSON.parse(rawBody);
    const newStatus = STATUS_BY_EVENT_TYPE[payload.type];
    if (!newStatus) {
      return { received: true }; // an event type we don't track (e.g. email.sent, email.opened)
    }

    const emailMessage = await this.emailMessageModel.findOneAndUpdate(
      { providerMessageId: payload.data.email_id },
      { status: newStatus },
      { returnDocument: 'after' },
    );

    if (!emailMessage) {
      this.logger.warn(
        `Webhook for unknown providerMessageId ${payload.data.email_id}`,
      );
      return { received: true };
    }

    if (newStatus === 'bounced' || newStatus === 'complained') {
      await this.emailSuppressionModel.updateOne(
        { email: emailMessage.to },
        {
          $setOnInsert: {
            reason: newStatus === 'bounced' ? 'bounce' : 'complaint',
          },
        },
        { upsert: true },
      );
    }

    return { received: true };
  }
}
