/** At most this many addresses of one host are tried per delivery attempt. */
export const MAX_ADDRESSES_TRIED = 4;

/**
 * Error codes that mean "could not even connect": nothing was sent, so trying the host's NEXT address is safe. Anything
 * else (a reset or a timeout after the request went out, a TLS failure, a bad response) may mean the receiver already
 * processed the POST, so it is NOT retried on another address — the task queue's own retry handles that, with the same
 * event id so the receiver can de-duplicate.
 */
const CONNECT_FAILURE_CODES: ReadonlySet<string> = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EADDRNOTAVAIL',
  'UND_ERR_CONNECT_TIMEOUT',
]);

function codeOf(value: unknown): string | undefined {
  if (typeof value === 'object' && value !== null && 'code' in value && typeof value.code === 'string') {
    return value.code;
  }
  return undefined;
}

export function isConnectFailure(error: unknown): boolean {
  const direct = codeOf(error);
  if (direct !== undefined && CONNECT_FAILURE_CODES.has(direct)) return true;
  const cause = typeof error === 'object' && error !== null && 'cause' in error ? codeOf(error.cause) : undefined;
  if (cause !== undefined && CONNECT_FAILURE_CODES.has(cause)) return true;
  // Node reports several failed addresses as an AggregateError whose members carry the codes.
  if (error instanceof AggregateError && error.errors.length > 0) return error.errors.every(isConnectFailure);
  return false;
}

/**
 * A host can resolve to several addresses (typically an IPv6 and an IPv4 one). Pinning only the FIRST, as the transport
 * used to, meant a host whose first record the server cannot route to (an IPv6 address from a machine with no IPv6)
 * failed every delivery although the host was fine. This tries each in order, moving on only after a connection failure.
 */
export async function sendToFirstReachable<Destination, Result>(
  destinations: readonly Destination[],
  attempt: (destination: Destination) => Promise<Result>,
): Promise<Result> {
  const candidates = destinations.slice(0, MAX_ADDRESSES_TRIED);
  let lastError: unknown = new Error('Webhook destination has no addresses.');
  for (const [index, destination] of candidates.entries()) {
    try {
      return await attempt(destination);
    } catch (error) {
      lastError = error;
      const hasNext = index < candidates.length - 1;
      if (!hasNext || !isConnectFailure(error)) throw error;
    }
  }
  throw lastError;
}
