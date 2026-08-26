export class AddCartItemCommand {
  constructor(
    readonly cartId: string,
    readonly productId: string,
    readonly variantSku: string,
    readonly quantity: number,
    readonly correlationId: string,
  ) {}
}
