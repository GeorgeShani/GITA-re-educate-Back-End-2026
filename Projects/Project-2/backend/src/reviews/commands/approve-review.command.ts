export class ApproveReviewCommand {
  constructor(
    readonly reviewId: string,
    readonly correlationId: string,
  ) {}
}
