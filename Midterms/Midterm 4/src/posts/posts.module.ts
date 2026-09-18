import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './schemas/post.schema.js';
import { PostsResolver } from './posts.resolver.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Post.name,
        schema: PostSchema,
      },
    ]),
  ],
  providers: [PostsService, PostsResolver],
})
export class PostsModule {}
