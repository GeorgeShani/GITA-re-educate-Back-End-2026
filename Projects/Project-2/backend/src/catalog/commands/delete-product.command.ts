export class DeleteProductCommand {
  constructor(
    readonly productId: string,
    readonly correlationId: string,
  ) {}
}
