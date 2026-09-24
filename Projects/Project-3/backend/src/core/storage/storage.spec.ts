import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@smithy/util-stream';
import { mockClient } from 'aws-sdk-client-mock';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeClock } from '#test/support/fake-clock.js';
import { LocalStorageDriver } from './local-storage.driver.js';
import { S3StorageDriver } from './s3-storage.driver.js';
import { attachmentDisposition } from './storage-driver.js';
import { StorageService } from './storage.service.js';
import { UnconfiguredStorageDriver } from './unconfigured-storage.driver.js';

const START = new Date('2026-03-01T12:00:00.000Z');

describe('LocalStorageDriver', () => {
  let root: string;
  let clock: FakeClock;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'gridline-local-'));
    clock = new FakeClock(START);
    driver = new LocalStorageDriver({ root, baseUrl: 'http://localhost:4000', secret: 'shh', clock });
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it('stores, reads back and deletes an object', async () => {
    await driver.put('companies/c1/files/f1', Buffer.from('a,b\n1,2\n'));
    expect((await driver.get('companies/c1/files/f1')).toString()).toBe('a,b\n1,2\n');

    await driver.delete('companies/c1/files/f1');
    await expect(stat(join(root, 'companies/c1/files/f1'))).rejects.toThrow();
  });

  it('deleting an object that is already gone is not an error', async () => {
    await expect(driver.delete('companies/c1/files/never-existed')).resolves.toBeUndefined();
  });

  it('refuses a key that would escape its root', async () => {
    await expect(driver.put('../../escape', Buffer.from('x'))).rejects.toThrow(/outside the root/);
    await expect(driver.get('../../etc/passwd')).rejects.toThrow(/outside the root/);
  });

  describe('signed download links', () => {
    async function link(name = 'report.csv') {
      const url = new URL(await driver.presignedGetUrl('companies/c1/files/f1', { expiresInSeconds: 300, downloadName: name }));
      return {
        url,
        params: {
          key: url.searchParams.get('key') ?? '',
          exp: url.searchParams.get('exp') ?? '',
          name: url.searchParams.get('name') ?? '',
          sig: url.searchParams.get('sig') ?? '',
        },
      };
    }

    it('points at this API and verifies', async () => {
      const { url, params } = await link();

      expect(url.origin).toBe('http://localhost:4000');
      expect(url.pathname).toBe('/storage/local');
      expect(driver.verify(params)).toEqual({ key: 'companies/c1/files/f1', downloadName: 'report.csv' });
    });

    it('stops working at expiry, on the injected clock', async () => {
      const { params } = await link();

      clock.advance(299_000);
      expect(driver.verify(params)).not.toBeNull();
      clock.advance(2_000);
      expect(driver.verify(params)).toBeNull();
    });

    it.each(['key', 'exp', 'name', 'sig'] as const)('rejects a link with a tampered %s', async (field) => {
      const { params } = await link();
      const tampered = { ...params, [field]: field === 'exp' ? String(Number(params.exp) + 3600) : `${params[field]}x` };

      expect(driver.verify(tampered)).toBeNull();
    });

    it('rejects a link signed with a different secret', async () => {
      const { params } = await link();
      const other = new LocalStorageDriver({ root, baseUrl: 'http://localhost:4000', secret: 'other', clock });

      expect(other.verify(params)).toBeNull();
    });

    it('rejects a non-numeric expiry', async () => {
      const { params } = await link();
      expect(driver.verify({ ...params, exp: 'soon' })).toBeNull();
    });
  });
});

describe('S3StorageDriver', () => {
  const s3 = mockClient(S3Client);
  const options = { region: 'eu-central-1', bucket: 'gridline-test', accessKeyId: 'AKIATEST', secretAccessKey: 'secret' };
  let driver: S3StorageDriver;

  beforeEach(() => {
    s3.reset();
    driver = new S3StorageDriver(options, new S3Client({ region: options.region, credentials: options }));
  });

  it('puts an object into the configured bucket with its detected content type', async () => {
    s3.on(PutObjectCommand).resolves({});

    await driver.put('companies/c1/files/f1', Buffer.from('a,b'), 'text/csv');

    const call = s3.commandCalls(PutObjectCommand)[0];
    expect(call?.args[0].input).toMatchObject({
      Bucket: 'gridline-test',
      Key: 'companies/c1/files/f1',
      ContentType: 'text/csv',
    });
    expect(Buffer.isBuffer(call?.args[0].input.Body)).toBe(true);
  });

  it('deletes an object', async () => {
    s3.on(DeleteObjectCommand).resolves({});
    await driver.delete('companies/c1/files/f1');

    expect(s3.commandCalls(DeleteObjectCommand)[0]?.args[0].input).toMatchObject({
      Bucket: 'gridline-test',
      Key: 'companies/c1/files/f1',
    });
  });

  it('reads an object back', async () => {
    s3.on(GetObjectCommand).resolves({ Body: sdkStreamMixin(Readable.from([Buffer.from('a,b\n1,2\n')])) });

    expect((await driver.get('companies/c1/files/f1')).toString()).toBe('a,b\n1,2\n');
  });

  it('propagates a storage failure instead of swallowing it', async () => {
    s3.on(PutObjectCommand).rejects(new Error('AccessDenied'));
    await expect(driver.put('k', Buffer.from('x'), 'text/csv')).rejects.toThrow('AccessDenied');
  });

  it('presigns a GET for the object: short-lived, signed, and saved under the original name', async () => {
    const url = new URL(
      await driver.presignedGetUrl('companies/c1/files/f1', { expiresInSeconds: 300, downloadName: 'Q1 numbers.csv' }),
    );

    expect(url.hostname).toBe('gridline-test.s3.eu-central-1.amazonaws.com');
    expect(url.pathname).toBe('/companies/c1/files/f1');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(url.searchParams.get('X-Amz-Credential')).toContain('AKIATEST');
    expect(url.searchParams.get('response-content-disposition')).toContain('attachment');
    expect(url.searchParams.get('response-content-disposition')).toContain('Q1 numbers.csv');
  });
});

describe('UnconfiguredStorageDriver', () => {
  it('fails on first use, naming exactly what to set', async () => {
    const driver = new UnconfiguredStorageDriver(['AWS_REGION', 'AWS_S3_BUCKET']);

    expect(() => driver.put()).toThrow(/AWS_REGION, AWS_S3_BUCKET/);
    expect(() => driver.presignedGetUrl()).toThrow(/STORAGE_DRIVER=local/);
  });
});

describe('StorageService', () => {
  it('mints download links that expire in five minutes, on the injected clock', async () => {
    const clock = new FakeClock(START);
    const root = await mkdtemp(join(tmpdir(), 'gridline-svc-'));
    try {
      const service = new StorageService(
        new LocalStorageDriver({ root, baseUrl: 'http://localhost:4000', secret: 's', clock }),
        clock,
      );

      const link = await service.downloadLink('companies/c/files/f', 'x.csv');

      expect(link.expiresAt.toISOString()).toBe('2026-03-01T12:05:00.000Z');
      expect(new URL(link.url).searchParams.get('exp')).toBe(String(Math.floor(link.expiresAt.getTime() / 1000)));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('round-trips bytes through the driver', async () => {
    const clock = new FakeClock(START);
    const root = await mkdtemp(join(tmpdir(), 'gridline-svc-'));
    try {
      const service = new StorageService(
        new LocalStorageDriver({ root, baseUrl: 'http://localhost:4000', secret: 's', clock }),
        clock,
      );
      await service.put('k/1', Buffer.from('hello'), 'text/csv');

      expect((await service.get('k/1')).toString()).toBe('hello');
      expect((await readFile(join(root, 'k/1'))).toString()).toBe('hello');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('attachmentDisposition', () => {
  it('carries a non-ASCII name in filename* and a safe fallback in filename', () => {
    const header = attachmentDisposition('ანგარიში.csv');

    expect(header).toContain('attachment;');
    expect(header).toMatch(/filename="[\x20-\x7e]*"/);
    expect(header).toContain("filename*=UTF-8''%E1%83%90");
  });

  it('cannot be used to inject a header or break out of the quoted name', () => {
    const header = attachmentDisposition('a"; filename="evil.exe\r\nSet-Cookie: x=1');

    expect(header).not.toMatch(/[\r\n]/);
    expect(header.match(/filename="/g)).toHaveLength(1);
    expect(header).not.toMatch(/filename="[^"]*"[^;]*"/);
  });
});
