export class RejectReturnCommand {
  constructor(
    readonly returnId: string,
    readonly adminNote: string,
    readonly correlationId: string,
  ) {}
}
