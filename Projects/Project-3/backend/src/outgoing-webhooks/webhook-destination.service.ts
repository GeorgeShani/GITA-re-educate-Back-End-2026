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
// Reserved or documentation-only: never a real receiver, and some networks route them inward.
blocked.addSubnet('192.0.0.0', 24, 'ipv4');
blocked.addSubnet('192.0.2.0', 24, 'ipv4');
blocked.addSubnet('198.51.100.0', 24, 'ipv4');
blocked.addSubnet('203.0.113.0', 24, 'ipv4');
blocked.addSubnet('240.0.0.0', 4, 'ipv4');
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
blocked.addSubnet('100::', 64, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
// NAT64: an address here is an IPv4 address in disguise, which this list would otherwise never get to check.
blocked.addSubnet('64:ff9b::', 96, 'ipv6');

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

  /**
   * EVERY address the host resolves to, each vetted and each pinned, in the order the resolver gave them. The caller
   * tries them in turn (`sendToFirstReachable`): pinning only the first made a host whose first record is unreachable
   * from here (an IPv6 address on a machine with no IPv6) fail every delivery although the host was fine.
   * One blocked address refuses the whole host: a name that resolves partly to a private address is not trusted.
   */
  async resolveAll(value: string): Promise<PinnedDestination[]> {
    const url = this.parseUrl(value);
    const results = lookupResultsSchema.parse(
      await this.lookupHost(url.hostname),
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
    return results.map((selected) => {
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
    });
  }

  /** The resolver, as its own method so a spec can hand back an answer no real DNS name would give. */
  protected lookupHost(hostname: string): Promise<unknown> {
    return lookup(hostname, { all: true, verbatim: true });
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
