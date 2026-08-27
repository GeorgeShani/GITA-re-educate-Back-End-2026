import { createHmac, timingSafeEqual } from 'node:crypto';

// Stateless confirmation link — no separate token field exists on
// NewsletterSubscriber (unlike S5's email-verification-token, which is
// hashed and stored), so the token is an HMAC of the email itself,
// verifiable without a DB round trip. Reuses COOKIE_SECRET rather than
// adding a new required env var for a link no email template sends yet
// (see newsletter.module.ts) — a deliberate, narrow key reuse, not a
// general pattern to repeat.
export function signNewsletterToken(email: string, secret: string): string {
  return createHmac('sha256', secret).update(email.toLowerCase()).digest('hex');
}

export function verifyNewsletterToken(
  email: string,
  token: string,
  secret: string,
): boolean {
  const expected = Buffer.from(signNewsletterToken(email, secret));
  const provided = Buffer.from(token);
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}
