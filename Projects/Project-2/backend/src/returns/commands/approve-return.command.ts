export class ApproveReturnCommand {
  constructor(
    readonly returnId: string,
    readonly adminNote: string | undefined,
    readonly correlationId: string,
  ) {}
}
