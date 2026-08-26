export class ApplyCouponCommand {
  constructor(
    readonly cartId: string,
    readonly couponCode: string,
    readonly correlationId: string,
  ) {}
}
