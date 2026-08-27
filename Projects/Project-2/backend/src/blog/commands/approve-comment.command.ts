export class ApproveCommentCommand {
  constructor(
    readonly commentId: string,
    readonly correlationId: string,
  ) {}
}
