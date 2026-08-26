import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';

import { DeleteMediaCommand } from './commands/delete-media.command';
import { RegisterMediaCommand } from './commands/register-media.command';
import { MediaOwnerContext } from './media-owner-context';
import { MediaDocument } from './schemas/media.schema';
import { STORAGE_PROVIDER_TOKEN } from './providers/storage-provider.interface';
import type {
  StorageProvider,
  UploadSignatureResult,
} from './providers/storage-provider.interface';

@Injectable()
export class MediaService {
  constructor(
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: StorageProvider,
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
  ) {}

  getUploadSignature(ownerContext: MediaOwnerContext): UploadSignatureResult {
    return this.storageProvider.getUploadSignature({
      folder: this.folderFor(ownerContext),
    });
  }

  register(
    publicId: string,
    ownerContext: MediaOwnerContext,
    userId: string,
  ): Promise<MediaDocument> {
    // The client names the folder it uploaded into by way of the public_id
    // Cloudinary assigns (it's prefixed with the signed folder); cross-
    // checking it here stops a client registering an asset it never
    // actually signed for.
    const expectedPrefix = `${this.folderFor(ownerContext)}/`;
    if (!publicId.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        `publicId does not belong to the "${ownerContext}" upload folder`,
      );
    }

    return this.commandBus.execute(
      new RegisterMediaCommand(
        publicId,
        ownerContext,
        userId,
        this.correlationId(),
      ),
    );
  }

  delete(mediaId: string, userId: string): Promise<void> {
    return this.commandBus.execute(
      new DeleteMediaCommand(mediaId, userId, this.correlationId()),
    );
  }

  private folderFor(ownerContext: MediaOwnerContext): string {
    const env =
      this.configService.get<string>('NODE_ENV') === 'production'
        ? 'prod'
        : 'dev';
    return `${env}/${ownerContext}s`;
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
