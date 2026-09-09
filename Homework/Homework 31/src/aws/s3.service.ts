import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UploadedFile {
  /** The S3 object key — store this so the file can be deleted later. */
  key: string;
  /** The public CloudFront URL clients should use to display the file. */
  url: string;
}

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cloudfrontUrl: string;
  private readonly rootFolder: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME');
    // Strip a trailing slash so callers can't accidentally end up with
    // "https://cdn.example.com//key" when building the public URL below.
    this.cloudfrontUrl = this.configService
      .getOrThrow<string>('AWS_CLOUDFRONT_URL')
      .replace(/\/+$/, '');

    // This bucket is shared across the whole classroom (see the AWS_S3_*
    // env vars — same bucket name across homeworks), so every key gets
    // namespaced under a root folder to keep this homework's uploads from
    // colliding with anyone else's. Defaults to "homework-31" so a missing
    // env var doesn't crash local dev, but the .env.example documents it
    // as something you're expected to set.
    this.rootFolder = this.configService
      .get<string>('AWS_S3_ROOT_FOLDER', 'homework-31')
      .replace(/^\/+|\/+$/g, '');

    this.client = new S3Client({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId:
          this.configService.getOrThrow<string>('AWS_IAM_ACCESS_KEY'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'AWS_IAM_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  /**
   * Uploads one file under `folder/<random-uuid>.<ext>` and returns both the
   * raw S3 key (needed to delete it later) and the CloudFront URL to serve
   * it from. The bucket itself stays private — only CloudFront can read it —
   * so this URL, not a direct S3 URL, is what you hand to clients.
   */
  async upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFile> {
    const key = `${this.rootFolder}/${folder}/${randomUUID()}${extname(file.originalname)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return { key, url: `${this.cloudfrontUrl}/${key}` };
  }

  uploadMany(
    files: Express.Multer.File[],
    folder: string,
  ): Promise<UploadedFile[]> {
    return Promise.all(files.map((file) => this.upload(file, folder)));
  }

  /**
   * Deletes an object by key. Left to throw on failure — callers that treat
   * a delete as best-effort (e.g. cleaning up a replaced profile photo)
   * should catch this themselves rather than have it silently swallowed
   * here, since a direct "delete this photo" request should surface the
   * error instead of pretending it worked.
   */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
