export class RegisterUserCommand {
  constructor(
    readonly firstName: string,
    readonly lastName: string,
    readonly email: string,
    readonly passwordHash: string,
    readonly phone: string | undefined,
    readonly correlationId: string,
  ) {}
}
