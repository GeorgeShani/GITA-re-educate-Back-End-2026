export class ConfirmNewsletterSubscriptionCommand {
  constructor(
    readonly email: string,
    readonly correlationId: string,
  ) {}
}
