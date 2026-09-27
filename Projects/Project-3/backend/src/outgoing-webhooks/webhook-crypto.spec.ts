import { describe, expect, it } from 'vitest';
import { loadConfig } from '#/config/load-config.js';
import { WebhookSecretService } from './webhook-secret.service.js';
import { signWebhook, verifyWebhookSignature } from './webhook-signature.js';

const KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
const REQUIRED_CONFIG = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  DIRECT_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'unit-test-access-secret',
  JWT_REFRESH_SECRET: 'unit-test-refresh-secret',
};

function secrets(): WebhookSecretService {
  return new WebhookSecretService(
    loadConfig({ ...REQUIRED_CONFIG, DATA_ENCRYPTION_KEY: KEY }),
  );
}

describe('outgoing webhook secrets and signatures', () => {
  it('shows a whsec_ secret once and decrypts its authenticated ciphertext', () => {
    const generated = secrets().generate();

    expect(generated.plaintext).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    expect(generated.encrypted.encryptedSecret).not.toContain(
      generated.plaintext,
    );
    expect(secrets().decrypt(generated.encrypted)).toBe(generated.plaintext);
  });

  it('rejects ciphertext whose authentication tag was changed', () => {
    const generated = secrets().generate();

    expect(() =>
      secrets().decrypt({
        ...generated.encrypted,
        secretTag: Buffer.alloc(16).toString('base64'),
      }),
    ).toThrow();
  });

  it('signs the exact timestamp dot body bytes and detects tampering', () => {
    const signed = signWebhook('whsec_test', '1772366400', '{"ok":true}');

    expect(signed.signature).toMatch(/^v1=[a-f0-9]{64}$/);
    expect(
      verifyWebhookSignature(
        'whsec_test',
        signed.timestamp,
        '{"ok":true}',
        signed.signature,
      ),
    ).toBe(true);
    expect(
      verifyWebhookSignature(
        'whsec_test',
        signed.timestamp,
        '{"ok":false}',
        signed.signature,
      ),
    ).toBe(false);
  });
});
