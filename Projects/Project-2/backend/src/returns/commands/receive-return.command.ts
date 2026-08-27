export class ReceiveReturnCommand {
  constructor(
    readonly returnId: string,
    readonly correlationId: string,
  ) {}
}
