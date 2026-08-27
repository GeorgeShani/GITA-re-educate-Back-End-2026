import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '../core/core.module';
import { AdminBlogController } from './admin-blog.controller';
import { ApproveCommentHandler } from './commands/handlers/approve-comment.handler';
import { CreatePostHandler } from './commands/handlers/create-post.handler';
import { DeletePostHandler } from './commands/handlers/delete-post.handler';
import { RejectCommentHandler } from './commands/handlers/reject-comment.handler';
import { ReplyToCommentHandler } from './commands/handlers/reply-to-comment.handler';
import { UpdatePostHandler } from './commands/handlers/update-post.handler';
import { CommentsService } from './comments.service';
import { PostCategoriesService } from './post-categories.service';
import { PostsService } from './posts.service';
import { Comment, CommentSchema } from './schemas/comment.schema';
import {
  PostCategory,
  PostCategorySchema,
} from './schemas/post-category.schema';
import { Post, PostSchema } from './schemas/post.schema';
import { Tag, TagSchema } from './schemas/tag.schema';
import { TagsService } from './tags.service';

const COMMAND_HANDLERS = [
  CreatePostHandler,
  UpdatePostHandler,
  DeletePostHandler,
  ApproveCommentHandler,
  RejectCommentHandler,
  ReplyToCommentHandler,
];

// Genuinely new domain — Post/PostCategory/Tag/Comment have had zero
// consumers anywhere since S3 (confirmed: no module, service, or
// controller referenced any of them). Admin CRUD/moderation only —
// the public blog read API is S11's own scope.
@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostCategory.name, schema: PostCategorySchema },
      { name: Tag.name, schema: TagSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
  ],
  controllers: [AdminBlogController],
  providers: [
    PostsService,
    PostCategoriesService,
    TagsService,
    CommentsService,
    ...COMMAND_HANDLERS,
  ],
})
export class BlogModule {}
