import { Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { FilesModule } from '#/files/files.module.js';
import { NotificationsModule } from '#/notifications/notifications.module.js';
import {
  CommentMutationsController,
  FileCommentsController,
} from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [DatabaseModule, FilesModule, NotificationsModule],
  controllers: [FileCommentsController, CommentMutationsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
