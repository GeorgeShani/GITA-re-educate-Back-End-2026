export class IssueRefundCommand {
  constructor(
    readonly orderId: string,
    readonly amountMinor: number,
    readonly reason: string | undefined,
    readonly correlationId: string,
  ) {}
}
