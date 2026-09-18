import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

export const MAX_PRODUCT_PHOTOS_PER_UPLOAD = 10;

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * Shared Multer options for photo uploads.
 *
 * We use memoryStorage (files land in `file.buffer`) rather than the more
 * commonly-tutorialized diskStorage: we're forwarding every file straight
 * to S3 and never need it on the server's own disk, so writing it there
 * first would just be wasted I/O — and it wouldn't survive a redeploy or
 * work at all if this app ever ran as multiple instances behind a load
 * balancer or in a serverless environment.
 */
export const PHOTO_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      callback(
        new BadRequestException(
          `Unsupported file type: ${file.mimetype}. Allowed types: ${[...ALLOWED_IMAGE_MIME_TYPES].join(', ')}`,
        ),
        false,
      );
      return;
    }

    callback(null, true);
  },
};
