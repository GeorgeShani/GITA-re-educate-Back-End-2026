import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

/** `link` is not here: linking needs a signed-in user and has its own route. */
export const PUBLIC_OAUTH_INTENTS = ['login', 'register', 'invite'] as const;
export type PublicOAuthIntent = (typeof PUBLIC_OAUTH_INTENTS)[number];

export class GoogleUrlDto {
  @ApiProperty({
    enum: PUBLIC_OAUTH_INTENTS,
    description:
      '`login` and `register` behave identically (a known Google account signs in, an unknown one is offered company registration); the value is for the frontend. `invite` binds the Google account to the invited user.',
  })
  @IsIn(PUBLIC_OAUTH_INTENTS)
  intent!: PublicOAuthIntent;

  @ApiPropertyOptional({ description: 'Required for `invite`: the token from the invitation email.' })
  @ValidateIf((body: GoogleUrlDto) => body.intent === 'invite')
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  inviteToken?: string;
}

export class OAuthUrlDto {
  @ApiProperty({ description: 'Send the browser here. Google sends it back to the API callback.' })
  @Expose()
  url!: string;
}
