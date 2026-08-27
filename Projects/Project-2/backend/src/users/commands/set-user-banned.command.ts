export class SetUserBannedCommand {
  constructor(
    readonly userId: string,
    readonly banned: boolean,
    readonly correlationId: string,
  ) {}
}
