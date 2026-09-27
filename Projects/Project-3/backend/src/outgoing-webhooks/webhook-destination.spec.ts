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
  JWT_REFRESH_SECRET: 'unit-test-refresh-secret',
};

function destinations(allowPrivate = false): WebhookDestinationService {
  return new WebhookDestinationService(
    loadConfig({
      ...REQUIRED_CONFIG,
      WEBHOOKS_ALLOW_PRIVATE_DESTINATIONS: allowPrivate ? 'true' : 'false',
    }),
  );
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
  ])('blocks private or reserved destination %s', (address, family) => {
    expect(isBlockedAddress(address, family)).toBe(true);
  });

  it('allows public addresses', () => {
    expect(isBlockedAddress('8.8.8.8', 4)).toBe(false);
    expect(isBlockedAddress('2606:4700:4700::1111', 6)).toBe(false);
  });
});
