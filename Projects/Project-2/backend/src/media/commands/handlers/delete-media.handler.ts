import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { MediaDeletedEvent } from '../../events/media-deleted.event';
import { Media, MediaDocument } from '../../schemas/media.schema';
import { DeleteMediaCommand } from '../delete-media.command';

@CommandHandler(DeleteMediaCommand)
export class DeleteMediaHandler
  extends TransactionalCommandHandler<DeleteMediaCommand>
  implements ICommandHandler<DeleteMediaCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: DeleteMediaCommand): Promise<void> {
    const media = await this.mediaModel.findOne({
      _id: command.mediaId,
      isDeleted: false,
    });
    if (!media) {
      throw new NotFoundException(`Media with id ${command.mediaId} not found`);
    }
    if (media.uploadedByUserId?.toString() !== command.requestedByUserId) {
      throw new ForbiddenException('You can only delete your own uploads');
    }

    await this.withTransaction(async (session) => {
      media.isDeleted = true;
      await media.save({ session });

      // The actual Cloudinary destroy() call is a real external side
      // effect — it happens in the media queue consumer reacting to this
      // event, never here inside the transaction (SCOPE.md B2: never do
      // side effects inside a command handler).
      await this.outboxRepository.write(
        new MediaDeletedEvent(media.id, media.publicId, command.correlationId),
        session,
      );
    });
  }
}
