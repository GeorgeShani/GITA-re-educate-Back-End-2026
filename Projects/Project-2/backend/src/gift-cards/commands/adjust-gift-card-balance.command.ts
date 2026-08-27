export class AdjustGiftCardBalanceCommand {
  constructor(
    readonly giftCardId: string,
    readonly delta: number,
    readonly correlationId: string,
  ) {}
}
