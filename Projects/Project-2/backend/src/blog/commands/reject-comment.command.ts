export class RejectCommentCommand {
  constructor(
    readonly commentId: string,
    readonly correlationId: string,
  ) {}
}
