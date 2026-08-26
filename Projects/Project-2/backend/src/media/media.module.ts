import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '../core/core.module';
import { QueueName } from '../core/queues/queue-names.enum';
import { DeleteMediaHandler } from './commands/handlers/delete-media.handler';
import { RegisterMediaHandler } from './commands/handlers/register-media.handler';
import { MediaController } from './media.controller';
import { MediaConsumer } from './media.consumer';
import { MediaService } from './media.service';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { STORAGE_PROVIDER_TOKEN } from './providers/storage-provider.interface';
import { Media, MediaSchema } from './schemas/media.schema';

const COMMAND_HANDLERS = [RegisterMediaHandler, DeleteMediaHandler];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
    BullModule.registerQueue({ name: QueueName.MEDIA }),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaConsumer,
    ...COMMAND_HANDLERS,
    CloudinaryStorageProvider,
    { provide: STORAGE_PROVIDER_TOKEN, useExisting: CloudinaryStorageProvider },
  ],
  exports: [MediaService],
})
export class MediaModule {}
