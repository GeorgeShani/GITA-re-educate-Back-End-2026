import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OAuthExchangeDto {
  @ApiProperty({ description: 'The single-use `code` from the redirect to `/session/oauth-complete`. Valid for 60 seconds.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  code!: string;
}
