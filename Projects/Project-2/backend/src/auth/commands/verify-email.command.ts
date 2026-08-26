export class VerifyEmailCommand {
  constructor(
    readonly token: string,
    readonly correlationId: string,
  ) {}
}
