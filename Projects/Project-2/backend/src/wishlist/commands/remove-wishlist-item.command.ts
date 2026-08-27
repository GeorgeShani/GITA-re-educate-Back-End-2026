export class RemoveWishlistItemCommand {
  constructor(
    readonly userId: string,
    readonly productId: string,
    readonly correlationId: string,
  ) {}
}
