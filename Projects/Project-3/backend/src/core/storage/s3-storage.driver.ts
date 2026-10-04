import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type PresignOptions, type StorageDriver, type StoredObject, attachmentDisposition } from './storage-driver.js';

export interface S3DriverOptions {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** An S3-compatible store's address (R2, MinIO). Absent: AWS. */
  endpoint?: string;
  forcePathStyle?: boolean;
}

/**
 * The default, graded storage. The bucket stays private: nothing is ever public,
 * downloads are short-lived presigned URLs minted per request after the caller's
 * access has been checked.
 */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(
    private readonly options: S3DriverOptions,
    client?: S3Client,
  ) {
    this.client =
      client ??
      new S3Client({
        region: options.region,
        ...(options.endpoint ? { endpoint: options.endpoint } : {}),
        ...(options.forcePathStyle ? { forcePathStyle: true } : {}),
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        },
      });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
    );
    if (!response.Body) throw new Error(`S3 returned no body for ${key}`);
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async *list(prefix: string): AsyncGenerator<StoredObject> {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.options.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key && object.LastModified) yield { key: object.Key, modifiedAt: object.LastModified };
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  async delete(key: string): Promise<void> {
    // S3 answers 204 whether or not the key existed.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }

  presignedGetUrl(key: string, options: PresignOptions): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        ResponseContentDisposition: attachmentDisposition(options.downloadName),
      }),
      { expiresIn: options.expiresInSeconds },
    );
  }
}
