import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';

import { PaginatedResult } from '../catalog/products.service';
import { escapeRegExp } from '../common/utils/escape-regexp.util';
import { FindEmailMessagesAdminDto } from './dto/find-email-messages-admin.dto';
import {
  EmailCategory,
  EmailMessage,
  EmailMessageDocument,
} from './schemas/email-message.schema';
import {
  EmailSuppression,
  EmailSuppressionDocument,
} from './schemas/email-suppression.schema';
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
    @InjectModel(EmailMessage.name)
    private readonly emailMessageModel: Model<EmailMessageDocument>,
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
    const isSuppressed = await this.emailSuppressionModel.exists({
      email: params.to,
    });
    if (isSuppressed) {
      this.logger.warn(
        `Skipped "${params.template}" to ${params.to} — address is suppressed`,
      );
      return false;
    }

    // SCOPE.md B4 dev safety gate — a guard in code, not a convention.
    // Rewrites the delivery target BEFORE the row is written, so the
    // EmailMessage row always reflects what actually happened.
    const deliveryTo = this.resolveDeliveryTarget(params.to);

    const { html, text } = await this.templateRenderer.render(
      params.template,
      params.variables,
    );

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
        this.logger.log(
          `Duplicate send suppressed for dedupeKey ${params.dedupeKey}`,
        );
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
      emailMessage.error =
        error instanceof Error ? error.message : String(error);
      await emailMessage.save();
      throw error;
    }
  }

  private resolveDeliveryTarget(to: string): string {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return to;
    }

    const allowlist = (
      this.configService.get<string>('MAIL_DEV_ALLOWLIST') ?? ''
    )
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

  async listMessages(
    query: FindEmailMessagesAdminDto,
  ): Promise<PaginatedResult<EmailMessageDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<EmailMessageDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.to) filter.to = new RegExp(escapeRegExp(query.to), 'i');

    const [items, total] = await Promise.all([
      this.emailMessageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.emailMessageModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  /** Re-dispatches through the same send() path, using the original's stored payload — never re-sends with the same dedupeKey. */
  async resend(emailMessageId: string): Promise<boolean> {
    const original = await this.emailMessageModel
      .findById(emailMessageId)
      .exec();
    if (!original) {
      throw new NotFoundException(
        `Email message with id ${emailMessageId} not found`,
      );
    }

    return this.send({
      template: original.template,
      to: original.to,
      subject: original.subject,
      category: original.category,
      dedupeKey: `${original.dedupeKey}:resend:${Date.now()}`,
      variables: original.payload,
    });
  }

  /** The one code path that ever writes reason: 'manual' — every other EmailSuppression row comes from a provider webhook. */
  async addSuppression(email: string): Promise<EmailSuppressionDocument> {
    const normalized = email.toLowerCase();
    try {
      return await this.emailSuppressionModel.create({
        email: normalized,
        reason: 'manual',
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const existing = await this.emailSuppressionModel
          .findOne({ email: normalized })
          .exec();
        if (existing) return existing;
      }
      throw error;
    }
  }

  async removeSuppression(email: string): Promise<void> {
    await this.emailSuppressionModel.deleteOne({ email: email.toLowerCase() });
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === MONGO_DUPLICATE_KEY_ERROR
    );
  }
}
