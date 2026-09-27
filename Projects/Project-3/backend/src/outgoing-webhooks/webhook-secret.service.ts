import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';

export interface EncryptedWebhookSecret {
  encryptedSecret: string;
  secretIv: string;
  secretTag: string;
}

@Injectable()
export class WebhookSecretService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  generate(): { plaintext: string; encrypted: EncryptedWebhookSecret } {
    const plaintext = `whsec_${randomBytes(32).toString('base64url')}`;
    return { plaintext, encrypted: this.encrypt(plaintext) };
  }

  encrypt(plaintext: string): EncryptedWebhookSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return {
      encryptedSecret: encrypted.toString('base64'),
      secretIv: iv.toString('base64'),
      secretTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(value: EncryptedWebhookSecret): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(value.secretIv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.secretTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(value.encryptedSecret, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(): Buffer {
    const encoded = this.config.DATA_ENCRYPTION_KEY;
    if (!encoded) {
      throw new ServiceUnavailableException(
        'Outgoing webhooks are not configured.',
      );
    }
    const source = Buffer.from(encoded, 'base64');
    if (source.length !== 32) {
      throw new ServiceUnavailableException(
        'DATA_ENCRYPTION_KEY must decode to 32 bytes.',
      );
    }
    return Buffer.from(
      hkdfSync(
        'sha256',
        source,
        Buffer.alloc(0),
        'gridline/webhook-secret/v1',
        32,
      ),
    );
  }
}
