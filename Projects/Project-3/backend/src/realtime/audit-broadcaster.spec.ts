import { describe, expect, it } from 'vitest';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { AuditBroadcaster } from './audit-broadcaster.js';

/** Just enough of a query runner to be a WeakMap key. */
const runner = (): object => ({});

function entry(id: string): AuditLogEntry {
  const row = new AuditLogEntry();
  row.id = id;
  return row;
}

function setup() {
  const emitted: string[] = [];
  const broadcaster = new AuditBroadcaster({
    auditAppended: async (row) => {
      emitted.push(row.id);
    },
  });
  const insert = (queryRunner: object, id: string) => broadcaster.afterInsert({ queryRunner, entity: entry(id) });
  return { broadcaster, emitted, insert };
}

describe('AuditBroadcaster', () => {
  it('listens to audit entries', () => {
    expect(setup().broadcaster.listenTo()).toBe(AuditLogEntry);
  });

  it('announces nothing at insert time — only when the transaction commits', () => {
    const { broadcaster, emitted, insert } = setup();
    const tx = runner();

    insert(tx, 'a');
    expect(emitted).toEqual([]);
    broadcaster.afterTransactionCommit({ queryRunner: tx });
    expect(emitted).toEqual(['a']);
  });

  it('announces every entry of one transaction, in order, once', () => {
    const { broadcaster, emitted, insert } = setup();
    const tx = runner();

    insert(tx, 'a');
    insert(tx, 'b');
    broadcaster.afterTransactionCommit({ queryRunner: tx });
    broadcaster.afterTransactionCommit({ queryRunner: tx });
    expect(emitted).toEqual(['a', 'b']);
  });

  it('announces nothing for a transaction that rolled back', () => {
    const { broadcaster, emitted, insert } = setup();
    const tx = runner();

    insert(tx, 'a');
    broadcaster.afterTransactionRollback({ queryRunner: tx });
    broadcaster.afterTransactionCommit({ queryRunner: tx });
    expect(emitted).toEqual([]);
  });

  it('keeps concurrent transactions apart: one committing does not release the other’s entries', () => {
    const { broadcaster, emitted, insert } = setup();
    const first = runner();
    const second = runner();

    insert(first, 'a');
    insert(second, 'b');
    broadcaster.afterTransactionCommit({ queryRunner: second });
    expect(emitted).toEqual(['b']);
    broadcaster.afterTransactionRollback({ queryRunner: first });
    expect(emitted).toEqual(['b']);
  });

  it('ignores a commit that had no audit entries', () => {
    const { broadcaster, emitted } = setup();
    broadcaster.afterTransactionCommit({ queryRunner: runner() });
    expect(emitted).toEqual([]);
  });
});
