export class UpdateCartItemQuantityCommand {
  constructor(
    readonly cartId: string,
    readonly itemId: string,
    readonly quantity: number,
    readonly correlationId: string,
  ) {}
}
