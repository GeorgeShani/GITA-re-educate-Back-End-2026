import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  AuditLogEntry,
  AuditLogEntrySchema,
} from './audit-log/audit-log-entry.schema';
import { AuditLogConsumer } from './audit-log/audit-log.consumer';
import { OutboxEvent, OutboxEventSchema } from './outbox/outbox.schema';
import { OutboxPublisher } from './outbox/outbox.publisher';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { OutboxRepository } from './outbox/outbox.repository';
import {
  StreamCheckpoint,
  StreamCheckpointSchema,
} from './outbox/stream-checkpoint.schema';
import { StreamCheckpointRepository } from './outbox/stream-checkpoint.repository';
import { QueueName } from './queues/queue-names.enum';

// The event backbone (SCOPE.md B2), built before any feature module.
// Feature modules that write outbox rows inside a transaction (via
// TransactionalCommandHandler, core/bus/) import CoreModule for
// OutboxRepository. TransactionalCommandHandler itself is an abstract
// base class, not a provider, so it isn't registered here — each
// concrete command handler subclasses it in its own feature module.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OutboxEvent.name, schema: OutboxEventSchema },
      { name: StreamCheckpoint.name, schema: StreamCheckpointSchema },
      { name: AuditLogEntry.name, schema: AuditLogEntrySchema },
    ]),
    // Additional queues (notifications, media, search, analytics,
    // webhooks) are registered by their own feature module when that
    // module's consumer ships — see queue-names.enum.ts.
    BullModule.registerQueue({ name: QueueName.AUDIT_LOG }),
  ],
  providers: [
    OutboxRepository,
    StreamCheckpointRepository,
    OutboxPublisher,
    OutboxRelayService,
    AuditLogConsumer,
  ],
  exports: [OutboxRepository],
})
export class CoreModule {}
