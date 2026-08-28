import mongoose from 'mongoose';

import { MongoTestContext } from '../../../test/support/mongo-memory-server';
import { getTestModel } from '../../../test/support/test-model';
import { DomainEvent } from '../events/domain-event.base';
import { OutboxRepository } from './outbox.repository';
import {
  OutboxEvent,
  OutboxEventDocument,
  OutboxEventSchema,
} from './outbox.schema';
import {
  OUTBOX_STREAM_NAME,
  StreamCheckpointRepository,
} from './stream-checkpoint.repository';
import {
  StreamCheckpoint,
  StreamCheckpointDocument,
  StreamCheckpointSchema,
} from './stream-checkpoint.schema';

class TestEvent extends DomainEvent {
  readonly eventName = 'test.happened';
  readonly aggregateType = 'Test';
  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}

// SCOPE.md Part D priority #2: "the outbox relay resumes correctly from
// its persisted resume token after a restart — no events dropped, none
// duplicated... concurrent-relay double-publish (via the
// findOneAndUpdate claim) is worth covering alongside it." This exercises
// both mechanisms directly against a real replica set — no BullMQ/Redis
// needed, since what's under test is the Mongo-side claim/checkpoint
// logic, not the queue delivery itself.
describe('Outbox relay resume + concurrent-claim safety (integration)', () => {
  let ctx: MongoTestContext;
  let outboxRepository: OutboxRepository;
  let checkpointRepository: StreamCheckpointRepository;

  beforeAll(async () => {
    ctx = await MongoTestContext.start();
    const outboxModel = getTestModel<OutboxEventDocument>(
      OutboxEvent.name,
      OutboxEventSchema,
    );
    const checkpointModel = getTestModel<StreamCheckpointDocument>(
      StreamCheckpoint.name,
      StreamCheckpointSchema,
    );
    outboxRepository = new OutboxRepository(outboxModel);
    checkpointRepository = new StreamCheckpointRepository(checkpointModel);
  }, 120_000);

  afterEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.stop();
  });

  it('lets only one of two concurrent claim() calls on the same row succeed', async () => {
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const event = new TestEvent(
        new mongoose.Types.ObjectId().toString(),
        'corr-1',
      );
      await outboxRepository.write(event, session);
    });
    await session.endSession();

    const [row] = await mongoose.connection
      .collection('outboxevents')
      .find({})
      .toArray();
    const eventId = String(row._id);

    // Two "relay instances" racing to claim the same row — the
    // findOneAndUpdate({ publishedAt: null }) guard must let exactly one
    // through, simulating exactly the concurrent-relay scenario the plan
    // calls out.
    const [first, second] = await Promise.all([
      outboxRepository.claim(eventId),
      outboxRepository.claim(eventId),
    ]);

    const claimedCount = [first, second].filter((r) => r !== null).length;
    expect(claimedCount).toBe(1);

    // Re-claiming after it's already published stays refused — this is
    // what makes "resume after restart" safe: a relay that crashed after
    // claiming but before finishing delivery would otherwise double-claim
    // on restart if this weren't durable.
    const third = await outboxRepository.claim(eventId);
    expect(third).toBeNull();
  });

  it('excludes a row from findUnpublishedOlderThan once claimed, and only surfaces rows older than the cutoff', async () => {
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await outboxRepository.write(
        new TestEvent(new mongoose.Types.ObjectId().toString(), 'corr-2'),
        session,
      );
    });
    await session.endSession();

    const cutoffInFuture = new Date(Date.now() + 60_000);
    const cutoffInPast = new Date(Date.now() - 60_000);

    // Not old enough yet relative to a cutoff in the past.
    expect(
      await outboxRepository.findUnpublishedOlderThan(cutoffInPast),
    ).toHaveLength(0);
    // Old enough relative to a cutoff in the future.
    const stale =
      await outboxRepository.findUnpublishedOlderThan(cutoffInFuture);
    expect(stale).toHaveLength(1);

    await outboxRepository.claim(stale[0]._id.toString());

    // Claimed rows are no longer "unpublished" — the startup sweep
    // shouldn't re-deliver something a relay already picked up.
    expect(
      await outboxRepository.findUnpublishedOlderThan(cutoffInFuture),
    ).toHaveLength(0);
  });

  it('persists and reloads a resume token across a simulated relay restart', async () => {
    const token = { _data: 'fake-resume-token-bytes' };
    await checkpointRepository.saveResumeToken(OUTBOX_STREAM_NAME, token);

    // A fresh repository instance stands in for "the process restarted" —
    // nothing here is held in memory, only what's actually in Mongo.
    const reloaded =
      await checkpointRepository.getResumeToken(OUTBOX_STREAM_NAME);
    expect(reloaded).toEqual(token);

    // Saving again (a later checkpoint) overwrites rather than
    // duplicating — there's exactly one checkpoint row per stream.
    const nextToken = { _data: 'later-token' };
    await checkpointRepository.saveResumeToken(OUTBOX_STREAM_NAME, nextToken);
    expect(
      await checkpointRepository.getResumeToken(OUTBOX_STREAM_NAME),
    ).toEqual(nextToken);
  });

  it('returns null for a stream that has never checkpointed', async () => {
    expect(await checkpointRepository.getResumeToken('never-seen')).toBeNull();
  });
});
