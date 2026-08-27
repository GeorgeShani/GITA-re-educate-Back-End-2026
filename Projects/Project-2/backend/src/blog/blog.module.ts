import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '../core/core.module';
import { AdminBlogController } from './admin-blog.controller';
import { BlogController } from './blog.controller';
import { ApproveCommentHandler } from './commands/handlers/approve-comment.handler';
import { CreatePostHandler } from './commands/handlers/create-post.handler';
import { DeletePostHandler } from './commands/handlers/delete-post.handler';
import { RejectCommentHandler } from './commands/handlers/reject-comment.handler';
import { ReplyToCommentHandler } from './commands/handlers/reply-to-comment.handler';
import { UpdatePostHandler } from './commands/handlers/update-post.handler';
import { CommentsService } from './comments.service';
import { PostCategoriesService } from './post-categories.service';
import { PostsService } from './posts.service';
import { PublicBlogService } from './public-blog.service';
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

// Genuinely new domain — Post/PostCategory/Tag/Comment had zero
// consumers anywhere until Phase 6 (A5) built admin CRUD/moderation.
// S11 adds the public read side + comment submission here.
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
  controllers: [AdminBlogController, BlogController],
  providers: [
    PostsService,
    PostCategoriesService,
    TagsService,
    CommentsService,
    PublicBlogService,
    ...COMMAND_HANDLERS,
  ],
})
export class BlogModule {}
