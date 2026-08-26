export class ResetPasswordCommand {
  constructor(readonly token: string, readonly newPasswordHash: string, readonly correlationId: string) {}
}
