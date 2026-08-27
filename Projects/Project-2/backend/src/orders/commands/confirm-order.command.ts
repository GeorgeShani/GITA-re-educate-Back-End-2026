export class ConfirmOrderCommand {
  constructor(
    readonly orderId: string,
    readonly correlationId: string,
  ) {}
}
