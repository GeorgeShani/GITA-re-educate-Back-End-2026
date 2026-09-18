import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard.js';
import type { RequestUser } from '../auth/types/auth-payload.type.js';
import { CreatePostInput } from './dto/create-post.input.js';
import { UpdatePostInput } from './dto/update-post.input.js';
import { PostModel } from './models/post.model.js';
import { toPostModel } from './posts.mapper.js';
import { PostsService } from './posts.service.js';

@Resolver(() => PostModel)
@UseGuards(GqlAuthGuard)
export class PostsResolver {
  constructor(private readonly postsService: PostsService) {}

  @Query(() => [PostModel])
  async posts(): Promise<PostModel[]> {
    const posts = await this.postsService.findAll();
    return posts.map(toPostModel);
  }

  @Query(() => PostModel)
  async post(@Args('id', { type: () => ID }) id: string): Promise<PostModel> {
    const post = await this.postsService.findOne(id);
    return toPostModel(post);
  }

  @Mutation(() => PostModel)
  async createPost(
    @CurrentUser() currentUser: RequestUser,
    @Args('input') input: CreatePostInput,
  ): Promise<PostModel> {
    const post = await this.postsService.create(currentUser.userId, input);
    return toPostModel(post);
  }

  @Mutation(() => PostModel)
  async updatePost(
    @CurrentUser() currentUser: RequestUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePostInput,
  ): Promise<PostModel> {
    const post = await this.postsService.update(id, currentUser.userId, input);
    return toPostModel(post);
  }

  @Mutation(() => Boolean)
  deletePost(
    @CurrentUser() currentUser: RequestUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.postsService.remove(id, currentUser.userId);
  }
}
