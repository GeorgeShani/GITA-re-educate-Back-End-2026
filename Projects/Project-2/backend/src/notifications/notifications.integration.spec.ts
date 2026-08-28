import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';

import { MongoTestContext } from '../../test/support/mongo-memory-server';
import { getTestModel } from '../../test/support/test-model';
import { ConsoleMailProvider } from './mail/console-mail.provider';
import { NotificationsService } from './notifications.service';
import {
  EmailMessage,
  EmailMessageDocument,
  EmailMessageSchema,
} from './schemas/email-message.schema';
import {
  EmailSuppression,
  EmailSuppressionDocument,
  EmailSuppressionSchema,
} from './schemas/email-suppression.schema';
import { TemplateRendererService } from './template-renderer.service';

const BASE_PARAMS = {
  template: 'verify-email',
  subject: 'Verify your email',
  category: 'transactional' as const,
  variables: {
    firstName: 'Ada',
    verificationUrl: 'https://example.com/verify',
  },
};

// SCOPE.md Part D priorities #3-#5: email idempotency, suppression, and
// the dev safety gate — "Test this one properly; the failure mode is
// mailing real strangers." Uses the real ConsoleMailProvider (no
// network) and the real TemplateRendererService (renders the actual
// verify-email.mjml from disk) so this exercises NotificationsService's
// full send() path, not a mocked stand-in for it.
describe('NotificationsService (integration)', () => {
  let ctx: MongoTestContext;
  let emailMessageModel: mongoose.Model<EmailMessageDocument>;
  let emailSuppressionModel: mongoose.Model<EmailSuppressionDocument>;
  const mailProvider = new ConsoleMailProvider();
  const templateRenderer = new TemplateRendererService();

  function buildService(
    configOverrides: Record<string, string>,
  ): NotificationsService {
    const configService = new ConfigService({
      NODE_ENV: 'development',
      ...configOverrides,
    });
    return new NotificationsService(
      emailMessageModel,
      emailSuppressionModel,
      mailProvider,
      templateRenderer,
      configService,
    );
  }

  beforeAll(async () => {
    ctx = await MongoTestContext.start();
    emailMessageModel = getTestModel<EmailMessageDocument>(
      EmailMessage.name,
      EmailMessageSchema,
    );
    emailSuppressionModel = getTestModel<EmailSuppressionDocument>(
      EmailSuppression.name,
      EmailSuppressionSchema,
    );
  }, 120_000);

  afterEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.stop();
  });

  describe('idempotency', () => {
    it('sends once for a given dedupeKey and silently no-ops on replay', async () => {
      const service = buildService({ MAIL_DEV_ALLOWLIST: 'user@example.com' });
      const params = {
        ...BASE_PARAMS,
        to: 'user@example.com',
        dedupeKey: 'verify-email:agg-1:evt-1',
      };

      const first = await service.send(params);
      const second = await service.send(params); // simulates a redelivered outbox event

      expect(first).toBe(true);
      expect(second).toBe(false);

      const rows = await emailMessageModel.find({
        dedupeKey: params.dedupeKey,
      });
      expect(rows).toHaveLength(1); // not two receipts for the same event
      expect(rows[0].status).toBe('sent');
    });

    it('treats a different dedupeKey as a genuinely new send even to the same address', async () => {
      const service = buildService({ MAIL_DEV_ALLOWLIST: 'user@example.com' });

      await service.send({
        ...BASE_PARAMS,
        to: 'user@example.com',
        dedupeKey: 'verify-email:agg-1:evt-1',
      });
      const second = await service.send({
        ...BASE_PARAMS,
        to: 'user@example.com',
        dedupeKey: 'verify-email:agg-1:evt-2',
      });

      expect(second).toBe(true);
      expect(
        await emailMessageModel.countDocuments({ to: 'user@example.com' }),
      ).toBe(2);
    });
  });

  describe('suppression', () => {
    it('never sends to a suppressed address, whatever the trigger', async () => {
      await emailSuppressionModel.create({
        email: 'bounced@example.com',
        reason: 'bounce',
      });
      const service = buildService({
        MAIL_DEV_ALLOWLIST: 'bounced@example.com',
      });

      const sent = await service.send({
        ...BASE_PARAMS,
        to: 'bounced@example.com',
        dedupeKey: 'verify-email:agg-2:evt-1',
      });

      expect(sent).toBe(false);
      // Not even a `queued` row gets written for a suppressed address.
      expect(
        await emailMessageModel.countDocuments({ to: 'bounced@example.com' }),
      ).toBe(0);
    });
  });

  describe('dev safety gate', () => {
    it('redirects a non-allowlisted address in non-production to MAIL_DEV_REDIRECT', async () => {
      const service = buildService({
        MAIL_DEV_REDIRECT: 'dev-catchall@example.com',
        MAIL_DEV_ALLOWLIST: '',
      });

      await service.send({
        ...BASE_PARAMS,
        to: 'a-real-stranger@example.com',
        dedupeKey: 'verify-email:agg-3:evt-1',
      });

      const row = await emailMessageModel.findOne({
        dedupeKey: 'verify-email:agg-3:evt-1',
      });
      // The stored row reflects what actually happened — sent to the
      // redirect, never to the real address.
      expect(row?.to).toBe('dev-catchall@example.com');
    });

    it('does not redirect an allowlisted address', async () => {
      const service = buildService({
        MAIL_DEV_REDIRECT: 'dev-catchall@example.com',
        MAIL_DEV_ALLOWLIST: 'qa@example.com, other@example.com',
      });

      await service.send({
        ...BASE_PARAMS,
        to: 'qa@example.com',
        dedupeKey: 'verify-email:agg-4:evt-1',
      });

      const row = await emailMessageModel.findOne({
        dedupeKey: 'verify-email:agg-4:evt-1',
      });
      expect(row?.to).toBe('qa@example.com');
    });

    it('refuses to send to a non-allowlisted address when no redirect is configured', async () => {
      const service = buildService({ MAIL_DEV_ALLOWLIST: '' });

      await expect(
        service.send({
          ...BASE_PARAMS,
          to: 'a-real-stranger@example.com',
          dedupeKey: 'verify-email:agg-5:evt-1',
        }),
      ).rejects.toThrow(/MAIL_DEV_REDIRECT/);

      // Refusing to guess a destination beats guessing wrong — nothing
      // gets written at all, not even a queued row to a wrong address.
      expect(
        await emailMessageModel.countDocuments({
          dedupeKey: 'verify-email:agg-5:evt-1',
        }),
      ).toBe(0);
    });

    it('never redirects in production, even to an unlisted address', async () => {
      const service = buildService({
        NODE_ENV: 'production',
        MAIL_DEV_REDIRECT: 'dev-catchall@example.com',
        MAIL_DEV_ALLOWLIST: '',
      });

      await service.send({
        ...BASE_PARAMS,
        to: 'a-real-customer@example.com',
        dedupeKey: 'verify-email:agg-6:evt-1',
      });

      const row = await emailMessageModel.findOne({
        dedupeKey: 'verify-email:agg-6:evt-1',
      });
      expect(row?.to).toBe('a-real-customer@example.com');
    });
  });
});
