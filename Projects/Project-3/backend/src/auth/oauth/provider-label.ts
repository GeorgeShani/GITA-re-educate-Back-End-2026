/** How a sign-in provider is named to a person, in an email: the stored key is for code ("google"), this is for reading. */
export function providerLabel(provider: string): string {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'password':
      return 'Password';
    default:
      return provider;
  }
}
