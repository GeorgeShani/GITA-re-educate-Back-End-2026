export class RemoveCartItemCommand {
  constructor(
    readonly cartId: string,
    readonly itemId: string,
    readonly correlationId: string,
  ) {}
}
