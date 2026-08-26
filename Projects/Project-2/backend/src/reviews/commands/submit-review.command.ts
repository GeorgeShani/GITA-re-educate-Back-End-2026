export class SubmitReviewCommand {
  constructor(
    readonly productId: string,
    readonly userId: string,
    readonly rating: number,
    readonly title: string | undefined,
    readonly body: string,
    readonly photoPublicIds: string[],
    readonly correlationId: string,
  ) {}
}
