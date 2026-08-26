import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import { BaseConsumer } from '../core/queues/base.consumer';
import { QueueName } from '../core/queues/queue-names.enum';
import { OutboxJobData } from '../core/outbox/outbox.publisher';
import { EmailCategory } from './schemas/email-message.schema';
import { NotificationsService } from './notifications.service';

interface EmailTemplateSpec {
  template: string;
  subject: string;
  category: EmailCategory;
  /** Builds Handlebars variables + the recipient from the event payload. */
  toVariables: (payload: Record<string, unknown>) => {
    to: string;
    variables: Record<string, unknown>;
  };
}

// SCOPE.md B4's event->email catalogue, one entry per template that has
// actually shipped. Only user.registered and user.password_reset_requested
// exist as of S4 (Phase 1's own scope — "two templates... every later
// phase adds templates against these rails"); event-routing.ts only
// routes those two event names to this queue, so nothing else reaches
// here yet. Later slices (S9 orders, S10 returns, S11 content) add their
// own entries in the same commit that adds their event-routing pattern.
const EMAIL_TEMPLATES: Record<string, EmailTemplateSpec> = {
  'user.registered': {
    template: 'verify-email',
    subject: 'Verify your email',
    category: 'transactional',
    toVariables: (payload) => ({
      to: payload.email as string,
      variables: {
        firstName: payload.firstName,
        verificationUrl: payload.verificationUrl,
      },
    }),
  },
  'user.password_reset_requested': {
    template: 'reset-password',
    subject: 'Reset your password',
    category: 'transactional',
    toVariables: (payload) => ({
      to: payload.email as string,
      variables: {
        firstName: payload.firstName,
        resetUrl: payload.resetUrl,
      },
    }),
  },
};

@Processor(QueueName.NOTIFICATIONS)
export class NotificationsConsumer extends BaseConsumer {
  constructor(
    cls: ClsService,
    private readonly notificationsService: NotificationsService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<OutboxJobData>): Promise<unknown> {
    const spec = EMAIL_TEMPLATES[job.data.eventName];
    if (!spec) {
      this.logger.warn(
        `No email template mapped for event "${job.data.eventName}" — skipping`,
      );
      return;
    }

    const { to, variables } = spec.toVariables(job.data.payload);
    return this.notificationsService.send({
      template: spec.template,
      to,
      subject: spec.subject,
      category: spec.category,
      dedupeKey: `${spec.template}:${job.data.aggregateId}:${job.data.eventId}`,
      variables,
    });
  }
}
