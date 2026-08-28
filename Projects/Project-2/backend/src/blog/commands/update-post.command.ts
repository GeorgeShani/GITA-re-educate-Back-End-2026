import { UpdatePostDto } from '@/blog/dto/update-post.dto';

export class UpdatePostCommand {
  constructor(
    readonly postId: string,
    readonly dto: UpdatePostDto,
    readonly correlationId: string,
  ) {}
}
