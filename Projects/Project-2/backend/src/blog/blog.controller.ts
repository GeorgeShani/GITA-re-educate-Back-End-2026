import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { FindPostsDto } from './dto/find-posts.dto';
import { SubmitCommentDto } from './dto/submit-comment.dto';
import { PublicBlogService } from './public-blog.service';

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly publicBlogService: PublicBlogService) {}

  @Get('posts')
  @ApiOperation({ summary: 'List published posts' })
  findPosts(@Query() query: FindPostsDto) {
    return this.publicBlogService.findPosts(query);
  }

  @Get('posts/:slug')
  @ApiOperation({ summary: 'Post detail by slug' })
  findPostBySlug(@Param('slug') slug: string) {
    return this.publicBlogService.findPostBySlug(slug);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Every post category' })
  findCategories() {
    return this.publicBlogService.findCategories();
  }

  @Get('tags')
  @ApiOperation({ summary: 'Every tag' })
  findTags() {
    return this.publicBlogService.findTags();
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Approved comments on a post' })
  findComments(@Param('id', ParseObjectIdPipe) id: string) {
    return this.publicBlogService.findApprovedComments(id);
  }

  // Guests can comment (schema-level, S3) — OptionalJwtAuthGuard so an
  // authenticated commenter still gets userId attribution, same
  // guest/auth duality as cart's own routes (S8).
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Submit a comment — held for moderation' })
  submitComment(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SubmitCommentDto,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.publicBlogService.submitComment(id, dto, userId);
  }
}
