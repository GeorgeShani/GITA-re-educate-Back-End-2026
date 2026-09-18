import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePostInput } from './dto/create-post.input.js';
import { UpdatePostInput } from './dto/update-post.input.js';
import { Post, PostDocument } from './schemas/post.schema.js';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
  ) {}

  create(authorId: string, input: CreatePostInput): Promise<PostDocument> {
    return this.postModel.create({
      title: input.title,
      content: input.content,
      author: new Types.ObjectId(authorId),
    });
  }

  findAll(): Promise<PostDocument[]> {
    return this.postModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<PostDocument> {
    const post = await this.postModel.findById(id).exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async update(
    id: string,
    authorId: string,
    input: UpdatePostInput,
  ): Promise<PostDocument> {
    const post = await this.findOne(id);
    this.assertOwnership(post, authorId);

    if (input.title !== undefined) {
      post.title = input.title;
    }

    if (input.content !== undefined) {
      post.content = input.content;
    }

    return post.save();
  }

  async remove(id: string, authorId: string): Promise<boolean> {
    const post = await this.findOne(id);
    this.assertOwnership(post, authorId);

    await post.deleteOne();
    return true;
  }

  private assertOwnership(post: PostDocument, authorId: string): void {
    if (post.author.toString() !== authorId) {
      throw new ForbiddenException(
        'You do not have permission to modify this post',
      );
    }
  }
}
