export class DeleteMediaCommand {
  constructor(
    readonly mediaId: string,
    readonly requestedByUserId: string,
    readonly correlationId: string,
  ) {}
}
