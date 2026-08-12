/** Minimal for now — full profile fields land with Phase F7 (account/auth). */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}
