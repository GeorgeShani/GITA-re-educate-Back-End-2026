import { Controller, Get, Inject, NotFoundException, Query, StreamableFile } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '#/common/auth/public.decorator.js';
import { LocalStorageDriver } from './local-storage.driver.js';
import { STORAGE_DRIVER, type StorageDriver, attachmentDisposition } from './storage-driver.js';

const downloadQuery = z.object({
  key: z.string().min(1),
  exp: z.string().min(1),
  name: z.string().min(1),
  sig: z.string().min(1),
});

/**
 * Serves the local driver's "presigned" URLs. `@Public()` because the signature IS
 * the credential, exactly as with S3. Excluded from the OpenAPI document — it is
 * a development stand-in whose existence must not change the published contract
 * depending on which driver a developer's `.env` selects — and answers 404 unless
 * the local driver is the one in use, so on S3 it is inert.
 */
@ApiTags('files')
@ApiExcludeController()
@Controller('storage')
export class LocalDownloadController {
  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  @Public()
  @Get('local')
  async download(@Query() query: Record<string, unknown>): Promise<StreamableFile> {
    if (!(this.driver instanceof LocalStorageDriver)) throw new NotFoundException();

    const parsed = downloadQuery.safeParse(query);
    const verified = parsed.success ? this.driver.verify(parsed.data) : null;
    // One answer for expired, tampered and malformed: nothing to learn from the difference.
    if (!verified) throw new NotFoundException('This download link is invalid or has expired.');

    return new StreamableFile(await this.driver.get(verified.key), {
      type: 'application/octet-stream',
      disposition: attachmentDisposition(verified.downloadName),
    });
  }
}
