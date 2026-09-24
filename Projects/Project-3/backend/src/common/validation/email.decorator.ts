import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';

/**
 * A trimmed, lower-cased, syntactically valid email. Normalising at the
 * boundary means every lookup and uniqueness check downstream compares like
 * with like — `Nino@Acme.com ` and `nino@acme.com` are the same account.
 *
 * `{ optional: true }` for PATCH bodies: documents the field as optional in
 * OpenAPI and skips validation when absent.
 */
export function NormalizedEmail(options: { optional?: boolean } = {}) {
  const schema = { example: 'nino@acme.com', maxLength: 254 };

  return applyDecorators(
    options.optional ? ApiPropertyOptional(schema) : ApiProperty(schema),
    ...(options.optional ? [IsOptional()] : []),
    Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsEmail(),
    MaxLength(254),
  );
}
