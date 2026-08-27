export class CancelOrderCommand {
  constructor(
    readonly orderId: string,
    readonly reason: string,
    readonly correlationId: string,
  ) {}
}
