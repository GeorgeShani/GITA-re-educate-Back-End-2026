import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import './cls-store.js';

/**
 * The one sanctioned way to read request context.
 *
 * Project-2 ended up with `private correlationId() { return this.cls.get(...) }`
 * copy-pasted into roughly twenty services. This exists so that never happens
 * here: inject this, not `ClsService`.
 *
 * Every getter is defensive about CLS being inactive, because scheduled jobs and
 * the background task runner execute outside any request.
 */
@Injectable()
export class RequestContextService {
  constructor(private readonly cls: ClsService) {}

  /** Present for any HTTP request; `undefined` inside a job unless re-established. */
  get correlationId(): string | undefined {
    return this.cls.isActive() ? this.cls.get('correlationId') : undefined;
  }

  get userId(): string | undefined {
    return this.cls.isActive() ? this.cls.get('userId') : undefined;
  }

  /**
   * The tenant boundary. Every tenant-scoped query narrows by this.
   * Populated by the auth guard in Milestone 3.
   */
  get companyId(): string | undefined {
    return this.cls.isActive() ? this.cls.get('companyId') : undefined;
  }

  get role(): 'admin' | 'employee' | undefined {
    return this.cls.isActive() ? this.cls.get('role') : undefined;
  }

  /** The inbound request's IP; `undefined` outside HTTP (jobs, scheduled tasks). */
  get ip(): string | undefined {
    return this.cls.isActive() ? this.cls.get('ip') : undefined;
  }

  /**
   * Called once per request by the auth guard. Every tenant-scoped query, log
   * line, audit entry and Observe span reads identity from here afterwards.
   */
  setAuthenticated(user: { userId: string; companyId: string; role: 'admin' | 'employee' }): void {
    if (!this.cls.isActive()) {
      throw new Error('Cannot set the authenticated user outside a request context.');
    }
    this.cls.set('userId', user.userId);
    this.cls.set('companyId', user.companyId);
    this.cls.set('role', user.role);
  }

  /**
   * Same as `companyId` but throws instead of returning `undefined`.
   * For code paths that are only ever reached behind the auth guard, where a
   * missing tenant is a bug and must not silently widen a query.
   */
  requireCompanyId(): string {
    const companyId = this.companyId;
    if (!companyId) {
      throw new Error(
        'No companyId in request context — this code path requires an authenticated, tenant-scoped request.',
      );
    }
    return companyId;
  }

  /**
   * Runs `work` inside a fresh context carrying `correlationId`. Non-HTTP entry
   * points (scheduled jobs, the background task runner) use this so their logs
   * and traces correlate with the request that queued them.
   */
  runWith<T>(correlationId: string, work: () => Promise<T>): Promise<T> {
    return this.cls.run(async () => {
      this.cls.set('correlationId', correlationId);
      return work();
    });
  }
}
