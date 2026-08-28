import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ADMIN_ROLES } from '@/common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { CommentsService } from './comments.service';
import { CreatePostDto } from './dto/create-post.dto';
import { FindCommentsAdminDto } from './dto/find-comments-admin.dto';
import { PostCategoryDto } from './dto/post-category.dto';
import { ReplyToCommentDto } from './dto/reply-to-comment.dto';
import { TagDto } from './dto/tag.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostCategoriesService } from './post-categories.service';
import { PostsService } from './posts.service';
import { TagsService } from './tags.service';

@ApiTags('admin-blog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.content)
@Controller('admin/blog')
export class AdminBlogController {
  constructor(
    private readonly postsService: PostsService,
    private readonly postCategoriesService: PostCategoriesService,
    private readonly tagsService: TagsService,
    private readonly commentsService: CommentsService,
  ) {}

  // Posts
  @Get('posts')
  @ApiOperation({ summary: 'List posts, including drafts' })
  findAllPosts(@Query() query: PaginationQueryDto) {
    return this.postsService.findAll(query);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Post detail' })
  findOnePost(@Param('id', ParseObjectIdPipe) id: string) {
    return this.postsService.findById(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post('posts')
  @ApiOperation({
    summary: 'Create a post — draft unless publishedAt is set',
  })
  createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.postsService.create(dto, userId);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch('posts/:id')
  @ApiOperation({
    summary:
      'Update a post — set publishedAt to (re)publish/schedule, null to revert to draft',
  })
  updatePost(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post' })
  async deletePost(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.postsService.delete(id);
  }

  // Categories
  @Get('categories')
  @ApiOperation({ summary: 'List post categories' })
  findAllCategories() {
    return this.postCategoriesService.findAll();
  }

  @Throttle(WRITE_THROTTLE)
  @Post('categories')
  @ApiOperation({ summary: 'Create a post category' })
  createCategory(@Body() dto: PostCategoryDto) {
    return this.postCategoriesService.create(dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a post category' })
  updateCategory(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: PostCategoryDto,
  ) {
    return this.postCategoriesService.update(id, dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post category' })
  async deleteCategory(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    await this.postCategoriesService.delete(id);
  }

  // Tags
  @Get('tags')
  @ApiOperation({ summary: 'List tags' })
  findAllTags() {
    return this.tagsService.findAll();
  }

  @Throttle(WRITE_THROTTLE)
  @Post('tags')
  @ApiOperation({ summary: 'Create a tag' })
  createTag(@Body() dto: TagDto) {
    return this.tagsService.create(dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete('tags/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag' })
  async deleteTag(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.tagsService.delete(id);
  }

  // Comments
  @Get('comments')
  @ApiOperation({ summary: 'The comment moderation queue' })
  findAllComments(@Query() query: FindCommentsAdminDto) {
    return this.commentsService.findAll(query);
  }

  @Throttle(WRITE_THROTTLE)
  @Post('comments/:id/approve')
  @ApiOperation({ summary: 'Approve a comment' })
  approveComment(@Param('id', ParseObjectIdPipe) id: string) {
    return this.commentsService.approve(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post('comments/:id/reject')
  @ApiOperation({ summary: 'Reject a comment' })
  rejectComment(@Param('id', ParseObjectIdPipe) id: string) {
    return this.commentsService.reject(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post('comments/:id/reply')
  @ApiOperation({
    summary: 'Post a staff reply — a new, auto-approved threaded comment',
  })
  replyToComment(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ReplyToCommentDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
  ) {
    return this.commentsService.reply(id, dto.body, userId, email);
  }
}
