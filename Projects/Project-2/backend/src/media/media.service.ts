import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '@/catalog/products.service';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { DeleteMediaCommand } from './commands/delete-media.command';
import { RegisterMediaCommand } from './commands/register-media.command';
import { AnyMediaOwnerContext } from './media-owner-context';
import { Media, MediaDocument } from './schemas/media.schema';
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
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
  ) {}

  getUploadSignature(
    ownerContext: AnyMediaOwnerContext,
  ): UploadSignatureResult {
    return this.storageProvider.getUploadSignature({
      folder: this.folderFor(ownerContext),
    });
  }

  register(
    publicId: string,
    ownerContext: AnyMediaOwnerContext,
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

  /** Admin override — bypasses DeleteMediaHandler's own-uploads-only check. */
  adminDelete(mediaId: string, adminUserId: string): Promise<void> {
    return this.commandBus.execute(
      new DeleteMediaCommand(mediaId, adminUserId, this.correlationId(), true),
    );
  }

  /** Admin media library browse — the public routes have no listing at all, per-uploader only. */
  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<MediaDocument>> {
    const { page = 1, take = 30 } = query;
    const filter = { isDeleted: false };

    const [items, total] = await Promise.all([
      this.mediaModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.mediaModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  private folderFor(ownerContext: AnyMediaOwnerContext): string {
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
