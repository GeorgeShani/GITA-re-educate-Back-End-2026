export class ReplyToReviewCommand {
  constructor(
    readonly reviewId: string,
    readonly reply: string,
    readonly correlationId: string,
  ) {}
}
