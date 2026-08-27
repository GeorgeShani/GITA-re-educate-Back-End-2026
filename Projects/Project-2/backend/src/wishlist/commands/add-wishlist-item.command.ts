export class AddWishlistItemCommand {
  constructor(
    readonly userId: string,
    readonly productId: string,
    readonly correlationId: string,
  ) {}
}
