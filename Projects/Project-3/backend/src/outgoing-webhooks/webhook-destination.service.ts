import { lookup } from 'node:dns/promises';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';

const lookupResultsSchema = z.array(
  z.object({
    address: z.string().min(1),
    family: z.union([z.literal(4), z.literal(6)]),
  }),
);

const blocked = new BlockList();
blocked.addSubnet('0.0.0.0', 8, 'ipv4');
blocked.addSubnet('10.0.0.0', 8, 'ipv4');
blocked.addSubnet('100.64.0.0', 10, 'ipv4');
blocked.addSubnet('127.0.0.0', 8, 'ipv4');
blocked.addSubnet('169.254.0.0', 16, 'ipv4');
blocked.addSubnet('172.16.0.0', 12, 'ipv4');
blocked.addSubnet('192.168.0.0', 16, 'ipv4');
blocked.addSubnet('198.18.0.0', 15, 'ipv4');
blocked.addSubnet('224.0.0.0', 4, 'ipv4');
blocked.addSubnet('::', 128, 'ipv6');
blocked.addSubnet('::1', 128, 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('ff00::', 8, 'ipv6');

export interface PinnedDestination {
  url: URL;
  address: string;
  family: 4 | 6;
  lookup: LookupFunction;
}

@Injectable()
export class WebhookDestinationService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  parseUrl(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Webhook URL is invalid.');
    }
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new BadRequestException(
        'Webhook URL must be an HTTP(S) URL without credentials.',
      );
    }
    if (
      url.protocol !== 'https:' &&
      !this.config.WEBHOOKS_ALLOW_PRIVATE_DESTINATIONS
    ) {
      throw new BadRequestException('Webhook URL must use HTTPS.');
    }
    return url;
  }

  async resolve(value: string): Promise<PinnedDestination> {
    const url = this.parseUrl(value);
    const results = lookupResultsSchema.parse(
      await lookup(url.hostname, { all: true, verbatim: true }),
    );
    if (results.length === 0)
      throw new Error('Webhook destination resolved to no addresses.');
    if (
      !this.config.WEBHOOKS_ALLOW_PRIVATE_DESTINATIONS &&
      results.some((result) => isBlockedAddress(result.address, result.family))
    ) {
      throw new Error(
        'Webhook destination resolves to a private or reserved address.',
      );
    }
    const selected = results[0];
    if (!selected)
      throw new Error('Webhook destination resolved to no addresses.');
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) callback(null, [selected]);
      else callback(null, selected.address, selected.family);
    };
    return {
      url,
      address: selected.address,
      family: selected.family,
      lookup: pinnedLookup,
    };
  }
}

export function isBlockedAddress(address: string, family: 4 | 6): boolean {
  if (isIP(address) !== family) return true;
  if (family === 6 && address.toLowerCase().startsWith('::ffff:')) {
    const mapped = address.slice(address.lastIndexOf(':') + 1);
    return isIP(mapped) !== 4 || blocked.check(mapped, 'ipv4');
  }
  return blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}
