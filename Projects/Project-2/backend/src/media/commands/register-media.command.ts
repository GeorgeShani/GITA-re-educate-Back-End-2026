export class RegisterMediaCommand {
  constructor(
    readonly publicId: string,
    readonly ownerContext: string,
    readonly uploadedByUserId: string,
    readonly correlationId: string,
  ) {}
}
