export class RefundReturnCommand {
  constructor(
    readonly returnId: string,
    readonly correlationId: string,
  ) {}
}
