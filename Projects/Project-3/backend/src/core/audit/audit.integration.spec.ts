import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { ClsService } from 'nestjs-cls';
import type { Repository } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresTestContext } from '#test/support/postgres-context.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { AuditLogEntry } from './audit-log-entry.entity.js';
import { AuditService } from './audit.service.js';

describe('audit log (integration)', () => {
  let ctx: PostgresTestContext;
  let repository: Repository<AuditLogEntry>;
  let cls: ClsService;
  let audit: AuditService;
  const companyId = randomUUID();

  beforeAll(async () => {
    ctx = await PostgresTestContext.start();
    repository = ctx.dataSource.getRepository(AuditLogEntry);
  }, 30_000);

  beforeEach(async () => {
    await ctx.reset();
    cls = new ClsService(new AsyncLocalStorage());
    audit = new AuditService(repository, new RequestContextService(cls));
  });

  afterAll(() => ctx.stop());

  it('stamps actor, tenant, ip and correlation id from the request context', async () => {
    const actorUserId = randomUUID();
    const targetId = randomUUID();

    const entry = await cls.run(async () => {
      cls.set('correlationId', 'corr-1');
      cls.set('userId', actorUserId);
      cls.set('companyId', companyId);
      cls.set('ip', '203.0.113.9');
      return audit.record({
        action: 'company.updated',
        target: { type: 'user', id: targetId },
        metadata: { role: 'employee' },
      });
    });

    const stored = await repository.findOneByOrFail({ id: entry.id });
    expect(stored).toMatchObject({
      companyId,
      actorUserId,
      action: 'company.updated',
      targetType: 'user',
      targetId,
      metadata: { role: 'employee' },
      ip: '203.0.113.9',
      correlationId: 'corr-1',
    });
  });

  it('records flows with no authenticated request by taking the tenant explicitly', async () => {
    const entry = await audit.record({
      action: 'company.activated',
      companyId,
      actorUserId: null,
    });

    expect(entry).toMatchObject({ companyId, actorUserId: null, ip: null, correlationId: null });
  });

  it('refuses to record with no tenant at all, rather than writing an orphan row', async () => {
    await expect(audit.record({ action: 'file.uploaded' })).rejects.toThrow(/companyId/);
    expect(await repository.count()).toBe(0);
  });

  it('commits or rolls back with the caller’s transaction', async () => {
    await expect(
      ctx.dataSource.transaction(async (manager) => {
        await audit.record({ action: 'employee.disabled', companyId }, manager);
        throw new Error('the state change failed');
      }),
    ).rejects.toThrow('the state change failed');

    expect(await repository.count()).toBe(0);
  });

  describe('immutability, enforced by the database', () => {
    it('rejects UPDATE', async () => {
      const entry = await audit.record({ action: 'company.updated', companyId });

      await expect(
        repository.update(entry.id, { action: 'tampered' }),
      ).rejects.toThrow(/immutable/);

      expect((await repository.findOneByOrFail({ id: entry.id })).action).toBe('company.updated');
    });

    it('rejects DELETE', async () => {
      const entry = await audit.record({ action: 'company.updated', companyId });

      await expect(repository.delete(entry.id)).rejects.toThrow(/immutable/);
      expect(await repository.count()).toBe(1);
    });

    it('still allows TRUNCATE, which is how test resets work', async () => {
      await audit.record({ action: 'company.updated', companyId });

      await ctx.reset();

      expect(await repository.count()).toBe(0);
    });
  });
});
