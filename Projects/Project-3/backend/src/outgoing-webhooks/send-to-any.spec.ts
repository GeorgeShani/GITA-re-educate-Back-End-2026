import { describe, expect, it } from 'vitest';
import { MAX_ADDRESSES_TRIED, isConnectFailure, sendToFirstReachable } from './send-to-any.js';

const withCode = (code: string, message = code) => Object.assign(new Error(message), { code });

describe('isConnectFailure', () => {
  it.each(['ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'EADDRNOTAVAIL', 'UND_ERR_CONNECT_TIMEOUT'])(
    'recognises %s',
    (code) => {
      expect(isConnectFailure(withCode(code))).toBe(true);
    },
  );

  it('looks at the cause, as undici and fetch wrap errors', () => {
    expect(isConnectFailure(new Error('fetch failed', { cause: withCode('ECONNREFUSED') }))).toBe(true);
    expect(isConnectFailure(new Error('fetch failed', { cause: withCode('ECONNRESET') }))).toBe(false);
  });

  it('accepts an AggregateError only when EVERY member is a connect failure', () => {
    expect(isConnectFailure(new AggregateError([withCode('ECONNREFUSED'), withCode('ENETUNREACH')]))).toBe(true);
    expect(isConnectFailure(new AggregateError([withCode('ECONNREFUSED'), withCode('ECONNRESET')]))).toBe(false);
    expect(isConnectFailure(new AggregateError([]))).toBe(false);
  });

  it.each([
    withCode('ECONNRESET'),
    withCode('UND_ERR_HEADERS_TIMEOUT'),
    withCode('UND_ERR_BODY_TIMEOUT'),
    withCode('ERR_TLS_CERT_ALTNAME_INVALID'),
    new Error('plain'),
    'a string',
    null,
    undefined,
  ])('does not treat %s as "nothing was sent"', (error) => {
    expect(isConnectFailure(error)).toBe(false);
  });
});

describe('sendToFirstReachable', () => {
  it('returns the first answer and stops', async () => {
    const tried: string[] = [];
    const result = await sendToFirstReachable(['v6', 'v4'], async (address) => {
      tried.push(address);
      return address;
    });
    expect(result).toBe('v6');
    expect(tried).toEqual(['v6']);
  });

  it('moves on to the next address after a connection failure — the dual-stack case', async () => {
    const tried: string[] = [];
    const result = await sendToFirstReachable(['v6', 'v4'], async (address) => {
      tried.push(address);
      if (address === 'v6') throw withCode('ENETUNREACH');
      return { status: 200 };
    });
    expect(result).toEqual({ status: 200 });
    expect(tried).toEqual(['v6', 'v4']);
  });

  it('does NOT move on after a failure that may have reached the receiver (it could process the POST twice)', async () => {
    const tried: string[] = [];
    await expect(
      sendToFirstReachable(['v6', 'v4'], async (address) => {
        tried.push(address);
        throw withCode('ECONNRESET');
      }),
    ).rejects.toMatchObject({ code: 'ECONNRESET' });
    expect(tried).toEqual(['v6']);
  });

  it('throws the last connection failure when every address is unreachable', async () => {
    await expect(
      sendToFirstReachable(['a', 'b', 'c'], async (address) => {
        throw withCode('ECONNREFUSED', `refused ${address}`);
      }),
    ).rejects.toThrow('refused c');
  });

  it('does not retry a received response: an HTTP error status is a result, not a failure', async () => {
    const tried: string[] = [];
    const result = await sendToFirstReachable(['a', 'b'], async (address) => {
      tried.push(address);
      return { status: 500 };
    });
    expect(result).toEqual({ status: 500 });
    expect(tried).toEqual(['a']);
  });

  it(`tries at most ${MAX_ADDRESSES_TRIED} addresses`, async () => {
    const tried: number[] = [];
    await expect(
      sendToFirstReachable(Array.from({ length: 10 }, (_, index) => index), async (address) => {
        tried.push(address);
        throw withCode('ECONNREFUSED');
      }),
    ).rejects.toBeDefined();
    expect(tried).toHaveLength(MAX_ADDRESSES_TRIED);
  });

  it('fails clearly with no addresses at all', async () => {
    await expect(sendToFirstReachable([], async () => 'never')).rejects.toThrow(/no addresses/);
  });
});
