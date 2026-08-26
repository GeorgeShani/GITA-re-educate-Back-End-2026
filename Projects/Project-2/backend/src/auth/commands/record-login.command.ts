// Records the entity write (lastLoginAt) and the domain event side of a
// successful login. Credential verification itself happens in
// AuthService BEFORE this command is dispatched — a command handler
// mutates state, it doesn't authenticate.
export class RecordLoginCommand {
  constructor(
    readonly userId: string,
    readonly correlationId: string,
  ) {}
}
