import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { MediaUploadedEvent } from '@/media/events/media-uploaded.event';
import { Media, MediaDocument } from '@/media/schemas/media.schema';
import { STORAGE_PROVIDER_TOKEN } from '@/media/providers/storage-provider.interface';
import type { StorageProvider } from '@/media/providers/storage-provider.interface';
import { RegisterMediaCommand } from '@/media/commands/register-media.command';

@CommandHandler(RegisterMediaCommand)
export class RegisterMediaHandler
  extends TransactionalCommandHandler<RegisterMediaCommand>
  implements ICommandHandler<RegisterMediaCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
    private readonly outboxRepository: OutboxRepository,
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: StorageProvider,
  ) {
    super(connection);
  }

  async execute(command: RegisterMediaCommand): Promise<MediaDocument> {
    // A read against Cloudinary's Admin API — never trust the client's
    // claimed width/height/format/bytes. Fetched outside the transaction
    // since it isn't a Mongo operation and has no consistency
    // requirement with it either way (a read has nothing to roll back).
    const metadata = await this.storageProvider.getAssetMetadata(
      command.publicId,
    );

    return this.withTransaction(async (session) => {
      const [media] = await this.mediaModel.create(
        [
          {
            publicId: metadata.publicId,
            url: metadata.url,
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            bytes: metadata.bytes,
            resourceType: metadata.resourceType,
            ownerContext: command.ownerContext,
            uploadedByUserId: command.uploadedByUserId,
          },
        ],
        { session },
      );

      await this.outboxRepository.write(
        new MediaUploadedEvent(
          media.id,
          media.publicId,
          command.ownerContext,
          command.uploadedByUserId,
          command.correlationId,
        ),
        session,
      );

      return media;
    });
  }
}
