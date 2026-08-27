export class DeleteAccountCommand {
  constructor(
    readonly userId: string,
    readonly correlationId: string,
  ) {}
}
