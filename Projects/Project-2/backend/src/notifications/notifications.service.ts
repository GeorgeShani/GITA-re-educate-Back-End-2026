import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EmailCategory, EmailMessage, EmailMessageDocument } from './schemas/email-message.schema';
import { EmailSuppression, EmailSuppressionDocument } from './schemas/email-suppression.schema';
import { MAIL_PROVIDER_TOKEN } from './mail/mail-provider.interface';
import type { MailProvider } from './mail/mail-provider.interface';
import { TemplateRendererService } from './template-renderer.service';

export interface SendEmailParams {
  template: string;
  to: string;
  subject: string;
  category: EmailCategory;
  /** `{template}:{aggregateId}:{eventId}` — uniquely indexed, this IS the idempotency mechanism. */
  dedupeKey: string;
  variables: Record<string, unknown>;
}

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(EmailMessage.name) private readonly emailMessageModel: Model<EmailMessageDocument>,
    @InjectModel(EmailSuppression.name)
    private readonly emailSuppressionModel: Model<EmailSuppressionDocument>,
    @Inject(MAIL_PROVIDER_TOKEN) private readonly mailProvider: MailProvider,
    private readonly templateRenderer: TemplateRendererService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Returns true if the send happened (or was durably queued for retry),
   * false if it was a legitimate no-op (suppressed, or a duplicate of an
   * already-sent dedupeKey).
   */
  async send(params: SendEmailParams): Promise<boolean> {
    const isSuppressed = await this.emailSuppressionModel.exists({ email: params.to });
    if (isSuppressed) {
      this.logger.warn(`Skipped "${params.template}" to ${params.to} — address is suppressed`);
      return false;
    }

    // SCOPE.md B4 dev safety gate — a guard in code, not a convention.
    // Rewrites the delivery target BEFORE the row is written, so the
    // EmailMessage row always reflects what actually happened.
    const deliveryTo = this.resolveDeliveryTarget(params.to);

    const { html, text } = await this.templateRenderer.render(params.template, params.variables);

    let emailMessage: EmailMessageDocument;
    try {
      // Written BEFORE the provider call — a crash mid-send is still
      // visible as a `queued` row rather than nothing at all.
      emailMessage = await this.emailMessageModel.create({
        template: params.template,
        to: deliveryTo,
        subject: params.subject,
        category: params.category,
        payload: params.variables,
        dedupeKey: params.dedupeKey,
        status: 'queued',
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        this.logger.log(`Duplicate send suppressed for dedupeKey ${params.dedupeKey}`);
        return false;
      }
      throw error;
    }

    try {
      const result = await this.mailProvider.send({
        to: deliveryTo,
        subject: params.subject,
        html,
        text,
        category: params.category,
      });
      emailMessage.status = 'sent';
      emailMessage.providerMessageId = result.providerMessageId;
      await emailMessage.save();
      return true;
    } catch (error) {
      emailMessage.status = 'failed';
      emailMessage.error = error instanceof Error ? error.message : String(error);
      await emailMessage.save();
      throw error;
    }
  }

  private resolveDeliveryTarget(to: string): string {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return to;
    }

    const allowlist = (this.configService.get<string>('MAIL_DEV_ALLOWLIST') ?? '')
      .split(',')
      .map((address) => address.trim().toLowerCase())
      .filter(Boolean);

    if (allowlist.includes(to.toLowerCase())) {
      return to;
    }

    const redirect = this.configService.get<string>('MAIL_DEV_REDIRECT');
    if (!redirect) {
      throw new Error(
        'MAIL_DEV_REDIRECT is not set — refusing to send to a non-allowlisted address outside production',
      );
    }

    this.logger.warn(`Dev gate: redirecting "${to}" -> "${redirect}"`);
    return redirect;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === MONGO_DUPLICATE_KEY_ERROR
    );
  }
}
