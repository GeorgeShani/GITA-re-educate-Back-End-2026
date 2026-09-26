import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { CursorQueryDto } from '#/common/pagination/cursor-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment-input.dto.js';
import { CommentDto, CommentPageDto } from './dto/comment.dto.js';

@ApiTags('comments')
@ApiBearerAuth()
@RequiresSubscription()
@Roles('admin', 'employee')
@RequireScopes('files:read')
@Controller('files')
export class FileCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get(':id/comments')
  @ApiOkResponse({ type: CommentPageDto })
  async list(
    @Param('id', ParseUUIDPipe) fileId: string,
    @Query() query: CursorQueryDto,
  ): Promise<CommentPageDto> {
    return toDto(
      CommentPageDto,
      mapPageData(await this.comments.list(fileId, query), CommentDto.from),
    );
  }
}

@ApiTags('comments')
@ApiBearerAuth()
@RequiresSubscription()
@Roles('admin', 'employee')
@Controller()
export class CommentMutationsController {
  constructor(private readonly comments: CommentsService) {}

  @Post('files/:id/comments')
  @ApiCreatedResponse({ type: CommentDto })
  async create(
    @Param('id', ParseUUIDPipe) fileId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentDto> {
    return CommentDto.from(await this.comments.create(fileId, dto));
  }

  @Patch('comments/:id')
  @ApiOkResponse({ type: CommentDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentDto> {
    return CommentDto.from(await this.comments.update(id, dto));
  }

  @Delete('comments/:id')
  @HttpCode(200)
  @ApiOkResponse({ type: CommentDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<CommentDto> {
    return CommentDto.from(await this.comments.remove(id));
  }
}
