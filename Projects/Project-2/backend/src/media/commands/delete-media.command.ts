export class DeleteMediaCommand {
  constructor(
    readonly mediaId: string,
    readonly requestedByUserId: string,
    readonly correlationId: string,
    /** Admin override — skips the own-uploads-only ownership check. */
    readonly bypassOwnership = false,
  ) {}
}
