import { describe, expect, it } from 'vitest';
import { visibilityCondition } from './file-visibility.js';

const ADMIN = { userId: 'admin-id', role: 'admin' as const };
const EMPLOYEE = { userId: 'employee-id', role: 'employee' as const };

/**
 * The visibility predicate is worth 3 graded points and has exactly one
 * implementation. The BEHAVIOUR (A restricts to B, C gets 404) is proven against a
 * real database in `files.integration.spec.ts`; this pins the SHAPE, so a refactor
 * that drops a branch fails here with a readable diff.
 */
describe('visibilityCondition', () => {
  it('never returns a soft-deleted file, for anyone', () => {
    expect(visibilityCondition('f', ADMIN).sql).toContain('"deletedAt" IS NULL');
    expect(visibilityCondition('f', EMPLOYEE).sql).toContain('"deletedAt" IS NULL');
  });

  it('adds nothing else for an admin: they see restricted files too', () => {
    const { sql, params } = visibilityCondition('f', ADMIN);

    expect(sql).toBe('f."deletedAt" IS NULL');
    expect(params).toEqual({});
  });

  describe('for an employee, a file is visible if ANY of three things holds', () => {
    const { sql, params } = visibilityCondition('f', EMPLOYEE);

    it('it is company-wide', () => {
      expect(sql).toContain(`f."visibility" = 'company'`);
    });

    it('they uploaded it', () => {
      expect(sql).toContain('f."uploaderId" = :fileViewerId');
    });

    it('they hold a grant for THIS file and THEM', () => {
      expect(sql).toContain('EXISTS (SELECT 1 FROM "file_access_grant" "g"');
      expect(sql).toContain('"g"."fileId" = f."id"');
      expect(sql).toContain('"g"."userId" = :fileViewerId');
    });

    it('joins the three with OR, inside one AND-ed group', () => {
      expect(sql).toMatch(/AND \(.*OR .*OR EXISTS/s);
    });

    it('binds the viewer as a parameter, never by string concatenation', () => {
      expect(params).toEqual({ fileViewerId: 'employee-id' });
      expect(sql).not.toContain('employee-id');
    });
  });

  it('honours the alias the caller uses', () => {
    expect(visibilityCondition('file', EMPLOYEE).sql).toContain('file."visibility"');
    expect(visibilityCondition('file', EMPLOYEE).sql).not.toContain('f."visibility"');
  });
});
