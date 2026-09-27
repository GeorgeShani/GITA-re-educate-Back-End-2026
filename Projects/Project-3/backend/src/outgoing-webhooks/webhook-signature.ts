import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignedWebhook {
  timestamp: string;
  signature: string;
}

export function signWebhook(
  secret: string,
  timestamp: string,
  body: string,
): SignedWebhook {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return { timestamp, signature: `v1=${digest}` };
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = signWebhook(secret, timestamp, body).signature;
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}
