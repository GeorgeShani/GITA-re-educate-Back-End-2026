export interface RequestReturnItemInput {
  orderItemId: string;
  quantity: number;
  reason: string;
}

export class RequestReturnCommand {
  constructor(
    readonly userId: string,
    readonly orderId: string,
    readonly items: RequestReturnItemInput[],
    readonly correlationId: string,
  ) {}
}
