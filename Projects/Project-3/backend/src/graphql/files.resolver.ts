import { BadRequestException } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CommentsService } from '#/comments/comments.service.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import type { FileAsset } from '#/files/file-asset.entity.js';
import { FilesService } from '#/files/files.service.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import {
  DataQualityReportType,
  FileCommentConnectionType,
  FileConnectionType,
  FilesConnectionArgs,
  FileType,
  FileUserType,
} from './files.types.js';
import {
  GraphqlLoaderFactory,
  type GraphqlLoaders,
  type GraphqlRequestContext,
} from './graphql-loaders.js';

interface ComplexityInput {
  args: Record<string, unknown>;
  childComplexity: number;
}

function boundedFirst(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function connectionComplexity({
  args,
  childComplexity,
}: ComplexityInput): number {
  return 5 + boundedFirst(args.first, 20) * childComplexity;
}

function versionsComplexity({ childComplexity }: ComplexityInput): number {
  return 1 + 50 * childComplexity;
}

/**
 * Read-only file graph. It delegates top-level visibility and pagination to
 * FilesService, then batches every relation that can fan out across a page.
 * No resolver declares API-key scopes, so ScopesGuard rejects API keys before
 * execution just like the analytics graph.
 */
@Resolver(() => FileType)
@Roles('admin', 'employee')
@RequiresSubscription()
export class FilesResolver {
  constructor(
    private readonly filesService: FilesService,
    private readonly commentsService: CommentsService,
    private readonly loaderFactory: GraphqlLoaderFactory,
    private readonly requestContext: RequestContextService,
  ) {}

  @Query(() => FileConnectionType, {
    name: 'files',
    description:
      'Files visible to the current member, with the same filters, keyset cursor, and access rules as GET /files.',
    complexity: connectionComplexity,
  })
  async files(
    @Args() args: FilesConnectionArgs,
  ): Promise<FileConnectionType> {
    const page = await this.filesService.list({
      limit: args.first,
      cursor: args.after,
      sort: args.sort,
      mimeType: args.filter?.mimeType,
      visibility: args.filter?.visibility,
      uploaderId: args.filter?.uploaderId,
      uploadedAfter: args.filter?.uploadedAfter,
      uploadedBefore: args.filter?.uploadedBefore,
      allVersions: args.filter?.allVersions,
      search: args.filter?.search,
      needsAttention: args.filter?.needsAttention,
      hasSensitiveData: args.filter?.hasSensitiveData,
    });
    return { nodes: page.data, pageInfo: page.meta };
  }

  @Query(() => FileType, {
    name: 'file',
    nullable: true,
    description:
      'One visible file. An inaccessible restricted file is indistinguishable from a missing file.',
    complexity: ({ childComplexity }) => 5 + childComplexity,
  })
  file(@Args('id', { type: () => ID }) id: string): Promise<FileAsset> {
    return this.filesService.requireVisible(id);
  }

  @ResolveField(() => FileUserType, { complexity: 2 })
  uploader(
    @Parent() file: FileAsset,
    @Context() context: GraphqlRequestContext,
  ) {
    return this.loaders(context).users.load(file.uploaderId);
  }

  @ResolveField(() => DataQualityReportType, { complexity: 4 })
  report(
    @Parent() file: FileAsset,
    @Context() context: GraphqlRequestContext,
  ) {
    return this.loaders(context).reports.load(file.id);
  }

  @ResolveField(() => [FileType], {
    complexity: versionsComplexity,
    description:
      'The newest versions of this file you can see (at most 50, newest first). The full history is GET /files/:id/versions.',
  })
  versions(
    @Parent() file: FileAsset,
    @Context() context: GraphqlRequestContext,
  ) {
    return this.loaders(context).versions.load(file.datasetId);
  }

  @ResolveField(() => [FileUserType], {
    nullable: true,
    description:
      'Restricted-file grantees. Visible only to an admin or this version’s uploader.',
    complexity: ({ childComplexity }) => 1 + 20 * childComplexity,
  })
  grants(
    @Parent() file: FileAsset,
    @Context() context: GraphqlRequestContext,
  ): Promise<FileUserType[] | null> {
    const role = this.requestContext.requireRole();
    const userId = this.requestContext.requireUserId();
    return role === 'admin' || file.uploaderId === userId
      ? this.loaders(context).grants.load(file.id)
      : Promise.resolve(null);
  }

  @ResolveField(() => Int, { complexity: 2 })
  commentCount(
    @Parent() file: FileAsset,
    @Context() context: GraphqlRequestContext,
  ) {
    return this.loaders(context).commentCounts.load(file.id);
  }

  @ResolveField(() => FileCommentConnectionType, {
    complexity: connectionComplexity,
    description:
      'A keyset-paginated comment thread. This reuses the REST comment service and its file-visibility gate.',
  })
  async comments(
    @Parent() file: FileAsset,
    @Args('first', { type: () => Int, defaultValue: 20 }) first: number,
    @Args('after', { type: () => String, nullable: true }) after?: string,
  ): Promise<FileCommentConnectionType> {
    if (!Number.isInteger(first) || first < 1 || first > 100) {
      throw new BadRequestException('`first` must be an integer from 1 to 100.');
    }
    const page = await this.commentsService.list(file.id, {
      limit: first,
      cursor: after,
    });
    return { nodes: page.data, pageInfo: page.meta };
  }

  private loaders(context: GraphqlRequestContext): GraphqlLoaders {
    if (!context.loaders) context.loaders = this.loaderFactory.create();
    return context.loaders;
  }
}
