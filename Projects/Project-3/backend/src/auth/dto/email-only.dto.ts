import { NormalizedEmail } from '#/common/validation/email.decorator.js';

/** Resend-activation and forgot-password: an email, nothing else. */
export class EmailOnlyDto {
  @NormalizedEmail()
  email!: string;
}
