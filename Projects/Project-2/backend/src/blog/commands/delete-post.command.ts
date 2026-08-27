export class DeletePostCommand {
  constructor(
    readonly postId: string,
    readonly correlationId: string,
  ) {}
}
