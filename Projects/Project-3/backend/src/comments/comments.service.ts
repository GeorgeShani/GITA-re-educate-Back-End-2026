import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';
import { decodeCursor } from '#/common/pagination/cursor.js';
import { applyCursor, toCursorPage } from '#/common/pagination/paginate.js';
import type { CursorPage } from '#/common/pagination/paginated-result.js';
import type { CursorQueryDto } from '#/common/pagination/cursor-query.dto.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { User } from '#/database/entities/user.entity.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { FileAccessGrant } from '#/files/file-access-grant.entity.js';
import type { FileAsset } from '#/files/file-asset.entity.js';
import { FilesService } from '#/files/files.service.js';
import { NotificationsService } from '#/notifications/notifications.service.js';
import { RealtimeEmitter } from '#/realtime/realtime-emitter.service.js';
import type {
  CreateCommentDto,
  UpdateCommentDto,
} from './dto/comment-input.dto.js';
import { FileCommentMention } from './file-comment-mention.entity.js';
import { FileComment } from './file-comment.entity.js';

export interface CommentUserView {
  id: string;
  fullName: string;
}

export interface CommentView {
  id: string;
  fileId: string;
  parentId: string | null;
  body: string | null;
  author: CommentUserView;
  mentionedUsers: CommentUserView[];
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeEmitter,
    private readonly context: RequestContextService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(
    fileId: string,
    query: CursorQueryDto,
  ): Promise<CursorPage<CommentView>> {
    await this.files.requireVisible(fileId);
    const companyId = this.context.requireCompanyId();
    const qb = this.tenantScope
      .forCompany(this.dataSource.getRepository(FileComment), companyId, 'c')
      .andWhere('c.fileId = :fileId', { fileId });
    applyCursor(
      qb,
      'c',
      query.cursor ? decodeCursor(query.cursor) : undefined,
      'ASC',
    );
    const page = await toCursorPage(qb, query.limit);
    return {
      data: await this.views(this.dataSource.manager, page.data),
      meta: page.meta,
    };
  }

  async create(fileId: string, dto: CreateCommentDto): Promise<CommentView> {
    const file = await this.files.requireVisible(fileId);
    const companyId = this.context.requireCompanyId();
    const authorId = this.context.requireUserId();

    const view = await this.dataSource.transaction(async (manager) => {
      await this.assertParent(manager, companyId, file.id, dto.parentId);
      const mentioned = await this.assertMentionable(
        manager,
        file,
        dto.mentionedUserIds,
      );
      const comment = await manager.save(
        manager.create(FileComment, {
          companyId,
          fileId: file.id,
          authorId,
          parentId: dto.parentId ?? null,
          body: dto.body,
          editedAt: null,
          deletedAt: null,
        }),
      );
      await this.replaceMentions(manager, comment.id, companyId, mentioned);
      await this.notifyNewMentions(
        manager,
        file,
        comment.id,
        authorId,
        mentioned,
      );
      await this.audit.record(
        {
          action: 'comment.created',
          target: { type: 'comment', id: comment.id },
          metadata: {
            fileId: file.id,
            parentId: comment.parentId,
            mentionCount: mentioned.length,
          },
        },
        manager,
      );
      return this.view(manager, comment);
    });
    await this.realtime.commentCreated(file.id, view);
    return view;
  }

  async update(id: string, dto: UpdateCommentDto): Promise<CommentView> {
    if (dto.body === undefined && dto.mentionedUserIds === undefined) {
      throw new BadRequestException(
        'Provide `body` and/or `mentionedUserIds`.',
      );
    }
    const existing = await this.requireTenantComment(id);
    const file = await this.files.requireVisible(existing.fileId);
    const userId = this.context.requireUserId();
    if (existing.authorId !== userId)
      throw new ForbiddenException('Only the author may edit this comment.');
    if (existing.deletedAt)
      throw new ConflictException('A deleted comment cannot be edited.');

    const view = await this.dataSource.transaction(async (manager) => {
      const comment = await manager.findOneOrFail(FileComment, {
        where: { id: existing.id, companyId: existing.companyId },
        lock: { mode: 'pessimistic_write' },
      });
      const current = await manager.find(FileCommentMention, {
        where: { commentId: comment.id },
      });
      const nextMentionIds =
        dto.mentionedUserIds === undefined
          ? current.map((mention) => mention.userId)
          : await this.assertMentionable(manager, file, dto.mentionedUserIds);
      const newlyMentioned = nextMentionIds.filter(
        (mentionedUserId) =>
          !current.some((mention) => mention.userId === mentionedUserId),
      );
      if (dto.body !== undefined) comment.body = dto.body;
      comment.editedAt = this.clock.now();
      await manager.save(comment);
      if (dto.mentionedUserIds !== undefined) {
        await this.replaceMentions(
          manager,
          comment.id,
          comment.companyId,
          nextMentionIds,
        );
      }
      await this.notifyNewMentions(
        manager,
        file,
        comment.id,
        userId,
        newlyMentioned,
      );
      await this.audit.record(
        {
          action: 'comment.updated',
          target: { type: 'comment', id: comment.id },
          metadata: { fileId: file.id, mentionCount: nextMentionIds.length },
        },
        manager,
      );
      return this.view(manager, comment);
    });
    await this.realtime.commentUpdated(file.id, view);
    return view;
  }

  async remove(id: string): Promise<CommentView> {
    const existing = await this.requireTenantComment(id);
    const file = await this.files.requireVisible(existing.fileId);
    const userId = this.context.requireUserId();
    const role = this.context.requireRole();
    if (existing.authorId !== userId && role !== 'admin') {
      throw new ForbiddenException(
        'Only the author or an admin may delete this comment.',
      );
    }

    const view = await this.dataSource.transaction(async (manager) => {
      const comment = await manager.findOneOrFail(FileComment, {
        where: { id: existing.id, companyId: existing.companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!comment.deletedAt) {
        comment.body = null;
        comment.deletedAt = this.clock.now();
        comment.editedAt = this.clock.now();
        await manager.save(comment);
        await manager.delete(FileCommentMention, { commentId: comment.id });
        await this.audit.record(
          {
            action: 'comment.deleted',
            target: { type: 'comment', id: comment.id },
            metadata: { fileId: file.id },
          },
          manager,
        );
      }
      return this.view(manager, comment);
    });
    await this.realtime.commentDeleted(file.id, view);
    return view;
  }

  private requireTenantComment(id: string): Promise<FileComment> {
    return this.tenantScope
      .forCompany(
        this.dataSource.getRepository(FileComment),
        this.context.requireCompanyId(),
        'c',
      )
      .andWhere('c.id = :id', { id })
      .getOne()
      .then((comment) => {
        if (!comment) throw new NotFoundException('Comment not found');
        return comment;
      });
  }

  private async assertParent(
    manager: EntityManager,
    companyId: string,
    fileId: string,
    parentId: string | undefined,
  ): Promise<void> {
    if (!parentId) return;
    const parent = await this.tenantScope
      .forCompany(manager.getRepository(FileComment), companyId, 'parent')
      .andWhere('parent.id = :parentId AND parent.fileId = :fileId', {
        parentId,
        fileId,
      })
      .getOne();
    if (!parent)
      throw new UnprocessableEntityException(
        'Reply target is not a comment on this file.',
      );
    if (parent.parentId)
      throw new UnprocessableEntityException(
        'Replies are limited to one level.',
      );
  }

  private async assertMentionable(
    manager: EntityManager,
    file: FileAsset,
    userIds: readonly string[],
  ): Promise<string[]> {
    const wanted = [...new Set(userIds)];
    if (wanted.length === 0) return [];
    const users = await this.tenantScope
      .forCompany(manager.getRepository(User), file.companyId, 'u')
      .andWhere('u.id IN (:...wanted)', { wanted })
      .andWhere("u.status = 'active'")
      .getMany();
    const grants =
      file.visibility === 'restricted'
        ? await manager.find(FileAccessGrant, {
            where: { fileId: file.id, userId: In(wanted) },
          })
        : [];
    const granted = new Set(grants.map((grant) => grant.userId));
    const visible = users.filter(
      (user) =>
        file.visibility === 'company' ||
        user.role === 'admin' ||
        user.id === file.uploaderId ||
        granted.has(user.id),
    );
    if (visible.length !== wanted.length) {
      throw new UnprocessableEntityException(
        'Every mentioned user must be an active member who can see this file.',
      );
    }
    return wanted;
  }

  private async replaceMentions(
    manager: EntityManager,
    commentId: string,
    companyId: string,
    userIds: readonly string[],
  ): Promise<void> {
    await manager.delete(FileCommentMention, { commentId });
    if (userIds.length > 0) {
      await manager.insert(
        FileCommentMention,
        userIds.map((userId) => ({ companyId, commentId, userId })),
      );
    }
  }

  private async notifyNewMentions(
    manager: EntityManager,
    file: FileAsset,
    commentId: string,
    authorId: string,
    userIds: readonly string[],
  ): Promise<void> {
    await this.notifications.notify(
      manager,
      file.companyId,
      userIds.filter((userId) => userId !== authorId),
      {
        type: 'comment.mentioned',
        payload: { commentId, fileId: file.id, mentionedByUserId: authorId },
      },
    );
  }

  private async views(
    manager: EntityManager,
    comments: FileComment[],
  ): Promise<CommentView[]> {
    if (comments.length === 0) return [];
    const authors = await manager.find(User, {
      where: { id: In([...new Set(comments.map((comment) => comment.authorId))]) },
    });
    const mentions = await manager.find(FileCommentMention, {
      where: { commentId: In(comments.map((comment) => comment.id)) },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    const authorById = new Map(authors.map((author) => [author.id, author]));
    const mentionsByComment = new Map<string, CommentUserView[]>();
    for (const mention of mentions) {
      if (!mention.user) continue;
      const users = mentionsByComment.get(mention.commentId) ?? [];
      users.push({ id: mention.user.id, fullName: mention.user.fullName });
      mentionsByComment.set(mention.commentId, users);
    }
    return comments.map((comment) => {
      const author = authorById.get(comment.authorId);
      if (!author) throw new Error(`Comment ${comment.id} has no author.`);
      return {
        id: comment.id,
        fileId: comment.fileId,
        parentId: comment.parentId,
        body: comment.body,
        author: { id: author.id, fullName: author.fullName },
        mentionedUsers: mentionsByComment.get(comment.id) ?? [],
        editedAt: comment.editedAt,
        deletedAt: comment.deletedAt,
        createdAt: comment.createdAt,
      };
    });
  }

  private async view(
    manager: EntityManager,
    comment: FileComment,
  ): Promise<CommentView> {
    const [view] = await this.views(manager, [comment]);
    if (!view) throw new Error(`Comment ${comment.id} could not be rendered.`);
    return view;
  }
}
