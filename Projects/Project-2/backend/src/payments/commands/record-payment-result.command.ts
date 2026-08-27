export class RecordPaymentResultCommand {
  constructor(
    readonly providerPaymentIntentId: string,
    readonly succeeded: boolean,
    readonly failureReason: string | undefined,
    readonly correlationId: string,
  ) {}
}
