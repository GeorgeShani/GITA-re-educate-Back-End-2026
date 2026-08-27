export class UpdateProfileCommand {
  constructor(
    readonly userId: string,
    readonly firstName: string | undefined,
    readonly lastName: string | undefined,
    readonly phone: string | undefined,
    readonly correlationId: string,
  ) {}
}
