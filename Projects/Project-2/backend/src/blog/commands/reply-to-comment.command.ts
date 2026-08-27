export class ReplyToCommentCommand {
  constructor(
    readonly parentCommentId: string,
    readonly body: string,
    readonly adminUserId: string,
    readonly adminEmail: string,
    readonly correlationId: string,
  ) {}
}
