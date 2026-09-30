import { describe, expect, it } from 'vitest';
import { loadConfig } from '#/config/load-config.js';
import {
  WebhookDestinationService,
  isBlockedAddress,
} from './webhook-destination.service.js';

const REQUIRED_CONFIG = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'unit-test-access-secret',
};

function destinations(allowPrivate = false): WebhookDestinationService {
  return new WebhookDestinationService(
    loadConfig({
      ...REQUIRED_CONFIG,
      WEBHOOKS_ALLOW_PRIVATE_DESTINATIONS: allowPrivate ? 'true' : 'false',
    }),
  );
}

/** Answers every lookup with a fixed list: lets a spec describe a host that is part public, part private. */
class ScriptedResolver extends WebhookDestinationService {
  constructor(private readonly answer: { address: string; family: 4 | 6 }[]) {
    super(loadConfig({ ...REQUIRED_CONFIG, WEBHOOKS_ALLOW_PRIVATE_DESTINATIONS: 'false' }));
  }

  protected override async lookupHost(): Promise<unknown> {
    return this.answer;
  }
}

describe('outgoing webhook destinations', () => {
  it('requires HTTPS unless the explicit development override is enabled', () => {
    expect(() => destinations().parseUrl('http://hooks.example.test')).toThrow(
      'Webhook URL must use HTTPS.',
    );
    expect(destinations(true).parseUrl('http://127.0.0.1:8080').protocol).toBe(
      'http:',
    );
  });

  it('rejects credentials and non-HTTP protocols', () => {
    expect(() =>
      destinations().parseUrl('https://user:secret@hooks.example.test'),
    ).toThrow(/without credentials/);
    expect(() => destinations().parseUrl('file:///etc/passwd')).toThrow(
      /HTTP\(S\)/,
    );
  });

  it.each([
    ['127.0.0.1', 4],
    ['10.0.0.1', 4],
    ['100.64.0.1', 4],
    ['169.254.169.254', 4],
    ['192.168.1.1', 4],
    ['::1', 6],
    ['fc00::1', 6],
    ['fe80::1', 6],
    ['::ffff:127.0.0.1', 6],
    ['0.0.0.0', 4],
    ['198.18.0.1', 4],
    ['224.0.0.1', 4],
    ['192.0.0.8', 4],
    ['192.0.2.10', 4],
    ['198.51.100.7', 4],
    ['203.0.113.9', 4],
    ['240.0.0.1', 4],
    ['255.255.255.255', 4],
    ['100::1', 6],
    ['2001:db8::1', 6],
    ['64:ff9b::7f00:1', 6],
    ['::', 6],
    ['ff02::1', 6],
  ])('blocks private or reserved destination %s', (address, family) => {
    expect(isBlockedAddress(address, family)).toBe(true);
  });

  it('refuses an address given for the wrong family or that is not an address at all', () => {
    expect(isBlockedAddress('8.8.8.8', 6)).toBe(true);
    expect(isBlockedAddress('not-an-ip', 4)).toBe(true);
  });

  it('resolves EVERY address of a host, each pinned to itself, so delivery can fall over between them', async () => {
    const all = await destinations(true).resolveAll('http://localhost:8080/hook');

    expect(all.length).toBeGreaterThan(0);
    for (const destination of all) {
      expect(destination.url.hostname).toBe('localhost');
      const pinned = await new Promise<string>((resolve, reject) =>
        destination.lookup('localhost', {}, (error, address) =>
          error ? reject(error) : resolve(String(address)),
        ),
      );
      expect(pinned).toBe(destination.address);
    }
    expect(new Set(all.map((destination) => destination.address)).size).toBe(all.length);
  });

  it('refuses a host that resolves to a private address, unless private destinations are allowed', async () => {
    await expect(destinations(false).resolveAll('https://localhost/hook')).rejects.toThrow(
      /private or reserved/,
    );
  });

  it('refuses the whole host when ANY of its addresses is private, even if the others are public (DNS rebinding)', async () => {
    const mixed = new ScriptedResolver([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);
    await expect(mixed.resolveAll('https://hooks.example.test/hook')).rejects.toThrow(
      /private or reserved/,
    );
  });

  it('pins every address of a host whose addresses are all public, in resolver order', async () => {
    const dual = new ScriptedResolver([
      { address: '2606:4700:4700::1111', family: 6 },
      { address: '93.184.216.34', family: 4 },
    ]);
    const all = await dual.resolveAll('https://hooks.example.test/hook');
    expect(all.map(({ address, family }) => ({ address, family }))).toEqual([
      { address: '2606:4700:4700::1111', family: 6 },
      { address: '93.184.216.34', family: 4 },
    ]);
  });

  it('allows public addresses', () => {
    expect(isBlockedAddress('8.8.8.8', 4)).toBe(false);
    expect(isBlockedAddress('2606:4700:4700::1111', 6)).toBe(false);
  });
});
