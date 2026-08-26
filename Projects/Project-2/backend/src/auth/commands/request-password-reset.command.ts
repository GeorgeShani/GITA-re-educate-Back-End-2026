export class RequestPasswordResetCommand {
  constructor(
    readonly email: string,
    readonly correlationId: string,
  ) {}
}
