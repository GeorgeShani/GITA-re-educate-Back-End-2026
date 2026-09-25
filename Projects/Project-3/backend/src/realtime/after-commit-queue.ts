/**
 * Holds items until the transaction that produced them COMMITS, and forgets them if it rolls back.
 *
 * Something written inside a transaction must not be announced from inside it: the transaction could
 * still roll back, and a client that refetches on the event could read the old state. A TypeORM
 * subscriber parks each insert against its query runner (`park`), then releases the batch when that
 * runner commits (`release`) or drops it when it rolls back (`drop`). TypeORM tells every subscriber
 * about every commit, and a `save` outside an explicit transaction is committed by a transaction of
 * TypeORM's own, so the same path covers both.
 */
export class AfterCommitQueue<T> {
  private readonly pending = new WeakMap<object, T[]>();

  park(queryRunner: object, item: T): void {
    const parked = this.pending.get(queryRunner) ?? [];
    parked.push(item);
    this.pending.set(queryRunner, parked);
  }

  /** The items parked for this runner, now safe to announce. */
  release(queryRunner: object): T[] {
    const parked = this.pending.get(queryRunner) ?? [];
    this.pending.delete(queryRunner);
    return parked;
  }

  drop(queryRunner: object): void {
    this.pending.delete(queryRunner);
  }
}
