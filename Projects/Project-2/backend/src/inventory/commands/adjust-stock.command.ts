export class AdjustStockCommand {
  constructor(
    readonly inventoryItemId: string,
    readonly delta: number,
    readonly reasonCode: string,
    readonly note: string | undefined,
    readonly adjustedByUserId: string,
    readonly correlationId: string,
  ) {}
}
