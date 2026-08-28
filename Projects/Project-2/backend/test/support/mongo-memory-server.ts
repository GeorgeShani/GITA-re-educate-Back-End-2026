import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// SCOPE.md Part D: "CI needs a replica set. Transaction and change-stream
// tests fail against standalone Mongo." A single-node replica set is the
// smallest topology that supports both multi-document transactions
// (TransactionalCommandHandler, every priority test below) and change
// streams (OutboxRelayService) — a plain mongodb-memory-server instance
// (no replSet option) supports neither.
export class MongoTestContext {
  private constructor(private readonly replSet: MongoMemoryReplSet) {}

  static async start(): Promise<MongoTestContext> {
    const replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replSet.getUri());
    return new MongoTestContext(replSet);
  }

  /** Drops every collection between tests without tearing down the replica set itself (expensive to restart per-test). */
  async reset(): Promise<void> {
    const { collections } = mongoose.connection;
    await Promise.all(
      Object.values(collections).map((collection) => collection.deleteMany({})),
    );
  }

  async stop(): Promise<void> {
    await mongoose.disconnect();
    await this.replSet.stop();
  }
}
