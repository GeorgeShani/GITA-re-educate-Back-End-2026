import { PostModel } from './models/post.model.js';
import { PostDocument } from './schemas/post.schema.js';

export function toPostModel(post: PostDocument): PostModel {
  return {
    id: post._id.toString(),
    title: post.title,
    content: post.content,
    authorId: post.author.toString(),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
