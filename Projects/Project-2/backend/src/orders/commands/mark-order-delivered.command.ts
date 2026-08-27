export class MarkOrderDeliveredCommand {
  constructor(
    readonly orderId: string,
    readonly correlationId: string,
  ) {}
}
