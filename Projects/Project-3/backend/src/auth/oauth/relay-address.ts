/**
 * Private-relay / alias-forwarding services. An address at one of these is not
 * where a person actually reads mail, and it says nothing about who they are — so
 * it is flagged on arrival and never used to discover an account or to send mail.
 */
const RELAY_DOMAINS = [
  'privaterelay.appleid.com',
  'relay.firefox.com',
  'mozmail.com',
  'anonaddy.com',
  'anonaddy.me',
  'simplelogin.com',
  'simplelogin.co',
  'slmail.me',
  'duck.com',
] as const;

export function isRelayAddress(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@').at(-1) ?? '';
  return RELAY_DOMAINS.some((relay) => domain === relay || domain.endsWith(`.${relay}`));
}

/**
 * What a provider's email may be used for. Only a verified, non-relay address is
 * ever a *contact* address (welcome the person, skip the activation email) or a
 * key for discovery; anything else is display information.
 */
export function contactFromProfile(profile: { email: string | null; emailVerified: boolean }): {
  email: string | null;
  verified: boolean;
} {
  if (!profile.email || isRelayAddress(profile.email)) return { email: null, verified: false };
  return { email: profile.email.trim().toLowerCase(), verified: profile.emailVerified };
}
