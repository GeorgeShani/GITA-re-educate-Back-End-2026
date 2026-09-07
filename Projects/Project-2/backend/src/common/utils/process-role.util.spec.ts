import { getProcessRole, runsWorkers } from './process-role.util';

// SCOPE.md B3 runs the same image twice on Railway, the second copy with
// ROLE=worker. If an `api` process still registered the consumers and the
// outbox relay, every queue job would be handled twice and two relays would
// race for the same outbox rows — so the gate is load-bearing, not cosmetic.
describe('process role', () => {
  const original = process.env.ROLE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ROLE;
    } else {
      process.env.ROLE = original;
    }
  });

  it('reads the three valid roles', () => {
    process.env.ROLE = 'api';
    expect(getProcessRole()).toBe('api');

    process.env.ROLE = 'worker';
    expect(getProcessRole()).toBe('worker');

    process.env.ROLE = 'all';
    expect(getProcessRole()).toBe('all');
  });

  it('defaults to running everything when unset', () => {
    delete process.env.ROLE;
    expect(getProcessRole()).toBe('all');
    expect(runsWorkers()).toBe(true);
  });

  it('runs workers for worker and all, but never for api', () => {
    process.env.ROLE = 'worker';
    expect(runsWorkers()).toBe(true);

    process.env.ROLE = 'all';
    expect(runsWorkers()).toBe(true);

    process.env.ROLE = 'api';
    expect(runsWorkers()).toBe(false);
  });
});

describe('CoreModule consumer gating', () => {
  const original = process.env.ROLE;

  afterEach(() => {
    jest.resetModules();
    if (original === undefined) {
      delete process.env.ROLE;
    } else {
      process.env.ROLE = original;
    }
  });

  /**
   * Module metadata is evaluated when the @Module decorator runs, i.e. at
   * import time — so the only way to observe a different ROLE is to re-import
   * the module under a fresh registry.
   */
  function providerNamesFor(role: string): string[] {
    process.env.ROLE = role;
    let names: string[] = [];
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { CoreModule } = require('@/core/core.module') as {
        CoreModule: object;
      };
      /* eslint-enable @typescript-eslint/no-require-imports */
      const providers =
        (Reflect.getMetadata('providers', CoreModule) as unknown[]) ?? [];
      // Only class providers matter here; factory/value providers are keyed
      // by tokens that have no meaningful name to assert on.
      names = providers
        .filter(
          (provider): provider is { name: string } =>
            typeof provider === 'function',
        )
        .map((provider) => provider.name);
    });
    return names;
  }

  it('registers the relay and audit consumer on a worker process', () => {
    const names = providerNamesFor('worker');
    expect(names).toContain('OutboxRelayService');
    expect(names).toContain('AuditLogConsumer');
  });

  it('registers them on an all-in-one process', () => {
    const names = providerNamesFor('all');
    expect(names).toContain('OutboxRelayService');
    expect(names).toContain('AuditLogConsumer');
  });

  it('keeps the every-minute stale-order sweep off an api process', () => {
    // The sweep cancels timed-out orders. Running it on every instance means
    // each one fetches the same batch and dispatches the same
    // CancelOrderCommand — idempotent, but N transactions and error-log
    // noise from whichever instances lose the race.
    process.env.ROLE = 'api';
    let apiNames: string[] = [];
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { OrdersModule } = require('@/orders/orders.module') as {
        OrdersModule: object;
      };
      /* eslint-enable @typescript-eslint/no-require-imports */
      const providers =
        (Reflect.getMetadata('providers', OrdersModule) as unknown[]) ?? [];
      apiNames = providers
        .filter(
          (provider): provider is { name: string } =>
            typeof provider === 'function',
        )
        .map((provider) => provider.name);
    });

    expect(apiNames).not.toContain('StaleOrderSweepService');
    expect(apiNames).not.toContain('InvoiceConsumer');
    // The HTTP side of orders must survive the gating.
    expect(apiNames).toContain('OrdersService');
  });

  it('registers neither on an api-only process', () => {
    const names = providerNamesFor('api');
    expect(names).not.toContain('OutboxRelayService');
    expect(names).not.toContain('AuditLogConsumer');
    // Everything else CoreModule owns must still be there — gating the
    // consumers must not disable the buses the HTTP side depends on.
    expect(names).toContain('OutboxRepository');
  });
});
