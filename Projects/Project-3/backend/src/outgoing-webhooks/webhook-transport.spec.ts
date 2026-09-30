import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo, LookupFunction } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '#/config/load-config.js';
import { isConnectFailure } from './send-to-any.js';
import { type PinnedDestination, WebhookDestinationService } from './webhook-destination.service.js';
import { UndiciWebhookTransport } from './webhook-transport.js';

/**
 * The real transport, over real loopback sockets (every other spec replaces it with a fake). What matters here is what
 * a fake cannot show: the connection goes to the PINNED address, never to whatever DNS says; a host's other addresses are
 * tried only after a connection failure; and a response that arrived — even a redirect or a 500 — is never re-sent.
 */
const REQUIRED_CONFIG = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'unit-test-access-secret',
};

class StubDestinations extends WebhookDestinationService {
  constructor(private readonly pinned: PinnedDestination[]) {
    super(loadConfig({ ...REQUIRED_CONFIG, WEBHOOKS_ALLOW_PRIVATE_DESTINATIONS: 'true' }));
  }

  override async resolveAll(): Promise<PinnedDestination[]> {
    return this.pinned;
  }
}

function pin(url: string, address: string, family: 4 | 6): PinnedDestination {
  const lookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
  return { url: new URL(url), address, family, lookup };
}

interface Received {
  body: string;
  headers: IncomingHttpHeaders;
}

interface Receiver {
  port: number;
  received: Received[];
  close: () => Promise<void>;
}

const open: Receiver[] = [];

/** A receiver on 127.0.0.1 only (so `::1` on the same port has nothing listening). */
function receiver(respond: (index: number) => { status: number; headers?: Record<string, string> }): Promise<Receiver> {
  const received: Received[] = [];
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      received.push({ body: Buffer.concat(chunks).toString('utf8'), headers: request.headers });
      const answer = respond(received.length - 1);
      response.writeHead(answer.status, answer.headers);
      response.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const handle: Receiver = {
        port,
        received,
        close: () => new Promise((done) => server.close(() => done())),
      };
      open.push(handle);
      resolve(handle);
    });
  });
}

const ok = () => ({ status: 200 });
const request = (port: number, path = '/hook') => ({
  url: `http://hooks.example.test:${port}${path}`,
  body: '{"hello":"world"}',
  headers: { 'content-type': 'application/json', 'webhook-signature': 'v1=abc' },
});

afterEach(async () => {
  await Promise.all(open.splice(0).map((handle) => handle.close().catch(() => undefined)));
});

describe('UndiciWebhookTransport (real sockets)', () => {
  it('posts the exact body and headers to the pinned address — the hostname is never looked up', async () => {
    const target = await receiver(ok);
    const input = request(target.port);
    // `hooks.example.test` does not resolve anywhere: reaching the receiver proves the pinned address was used, not DNS.
    const transport = new UndiciWebhookTransport(new StubDestinations([pin(input.url, '127.0.0.1', 4)]));

    const response = await transport.send(input);

    expect(response).toEqual({ status: 200 });
    expect(target.received).toHaveLength(1);
    expect(target.received[0]?.body).toBe(input.body);
    expect(target.received[0]?.headers['webhook-signature']).toBe('v1=abc');
    expect(target.received[0]?.headers.host).toBe(`hooks.example.test:${target.port}`);
  });

  it('falls over to the host’s next address when the first cannot be connected to (the dual-stack case)', async () => {
    const target = await receiver(ok);
    const input = request(target.port);
    // Nothing listens on ::1 at this port (the receiver is IPv4-only), so the first address fails to connect.
    const transport = new UndiciWebhookTransport(
      new StubDestinations([pin(input.url, '::1', 6), pin(input.url, '127.0.0.1', 4)]),
    );

    const response = await transport.send(input);

    expect(response).toEqual({ status: 200 });
    expect(target.received).toHaveLength(1);
  });

  it('rejects with a connection failure when no address can be connected to', async () => {
    const closed = await receiver(ok);
    const input = request(closed.port);
    await closed.close();
    const transport = new UndiciWebhookTransport(
      new StubDestinations([pin(input.url, '::1', 6), pin(input.url, '127.0.0.1', 4)]),
    );

    const error = await transport.send(input).then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect(error).toBeDefined();
    expect(isConnectFailure(error)).toBe(true);
  });

  it('never re-sends a request the receiver answered — even with an error status — to another address', async () => {
    const target = await receiver(() => ({ status: 500 }));
    const input = request(target.port);
    const transport = new UndiciWebhookTransport(
      new StubDestinations([pin(input.url, '127.0.0.1', 4), pin(input.url, '127.0.0.1', 4)]),
    );

    const response = await transport.send(input);

    expect(response).toEqual({ status: 500 });
    expect(target.received).toHaveLength(1);
  });

  it('does not follow a redirect: the answer is returned as it is and the target is never contacted', async () => {
    const elsewhere = await receiver(ok);
    const target = await receiver(() => ({
      status: 302,
      headers: { location: `http://127.0.0.1:${elsewhere.port}/stolen` },
    }));
    const input = request(target.port);
    const transport = new UndiciWebhookTransport(new StubDestinations([pin(input.url, '127.0.0.1', 4)]));

    const response = await transport.send(input);

    expect(response).toEqual({ status: 302 });
    expect(elsewhere.received).toEqual([]);
  });
});
