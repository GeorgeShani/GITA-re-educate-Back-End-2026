export class RejectReviewCommand {
  constructor(
    readonly reviewId: string,
    readonly correlationId: string,
  ) {}
}
