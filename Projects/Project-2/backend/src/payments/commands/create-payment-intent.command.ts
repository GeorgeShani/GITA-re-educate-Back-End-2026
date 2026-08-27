export class CreatePaymentIntentCommand {
  constructor(
    readonly orderId: string,
    readonly correlationId: string,
  ) {}
}
