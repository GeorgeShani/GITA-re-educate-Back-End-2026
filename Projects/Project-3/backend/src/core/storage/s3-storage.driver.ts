import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type PresignOptions, type StorageDriver, attachmentDisposition } from './storage-driver.js';

export interface S3DriverOptions {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
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
