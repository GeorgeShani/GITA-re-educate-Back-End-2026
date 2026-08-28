import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';

import { PaginatedResult } from '@/catalog/products.service';
import { SubmitCommentDto } from './dto/submit-comment.dto';
import { FindPostsDto } from './dto/find-posts.dto';
import { Comment, CommentDocument } from './schemas/comment.schema';
import {
  PostCategory,
  PostCategoryDocument,
} from './schemas/post-category.schema';
import { Post, PostDocument } from './schemas/post.schema';
import { Tag, TagDocument } from './schemas/tag.schema';

// Separate from the admin PostsService/CommentsService for the same
// reason AdminProductsService is separate from ProductsService: a
// scheduled-but-not-yet-live post (or a pending comment) can never leak
// through this read path.
@Injectable()
export class PublicBlogService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(PostCategory.name)
    private readonly postCategoryModel: Model<PostCategoryDocument>,
    @InjectModel(Tag.name) private readonly tagModel: Model<TagDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
  ) {}

  async findPosts(query: FindPostsDto): Promise<PaginatedResult<PostDocument>> {
    const { page = 1, take = 30 } = query;
    const filter = this.publishedFilter();
    if (query.category) filter.categoryId = new Types.ObjectId(query.category);
    if (query.tag) filter.tagIds = new Types.ObjectId(query.tag);

    const [items, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async findPostBySlug(slug: string): Promise<PostDocument> {
    const post = await this.postModel
      .findOne({ slug, ...this.publishedFilter() })
      .exec();
    if (!post) {
      throw new NotFoundException(`Post "${slug}" not found`);
    }
    return post;
  }

  findCategories(): Promise<PostCategoryDocument[]> {
    return this.postCategoryModel.find({}).sort({ name: 1 }).exec();
  }

  findTags(): Promise<TagDocument[]> {
    return this.tagModel.find({}).sort({ name: 1 }).exec();
  }

  findApprovedComments(postId: string): Promise<CommentDocument[]> {
    return this.commentModel
      .find({ postId: new Types.ObjectId(postId), status: 'approved' })
      .sort({ createdAt: 1 })
      .exec();
  }

  async submitComment(
    postId: string,
    dto: SubmitCommentDto,
    userId: string | undefined,
  ): Promise<CommentDocument> {
    const postExists = await this.postModel.exists({
      _id: postId,
      ...this.publishedFilter(),
    });
    if (!postExists) {
      throw new NotFoundException(`Post with id ${postId} not found`);
    }

    return this.commentModel.create({
      postId: new Types.ObjectId(postId),
      userId: userId ? new Types.ObjectId(userId) : undefined,
      authorName: dto.authorName,
      authorEmail: dto.authorEmail,
      body: dto.body,
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : undefined,
      status: 'pending',
    });
  }

  // publishedAt !== null AND not scheduled for the future — the
  // schema's own comment on Post.publishedAt describes exactly this
  // "checked at read time" scheduled-publish behavior.
  private publishedFilter(): QueryFilter<PostDocument> {
    return { publishedAt: { $ne: null, $lte: new Date() } };
  }
}
