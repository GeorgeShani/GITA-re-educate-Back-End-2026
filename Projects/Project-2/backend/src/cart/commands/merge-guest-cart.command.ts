export class MergeGuestCartCommand {
  constructor(
    readonly guestToken: string,
    readonly userId: string,
    readonly correlationId: string,
  ) {}
}
