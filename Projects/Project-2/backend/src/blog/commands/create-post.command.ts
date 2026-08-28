import { CreatePostDto } from '@/blog/dto/create-post.dto';

export class CreatePostCommand {
  constructor(
    readonly dto: CreatePostDto,
    readonly authorId: string,
    readonly correlationId: string,
  ) {}
}
