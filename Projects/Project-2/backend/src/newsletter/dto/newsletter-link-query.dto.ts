import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

// Shared by the confirm and unsubscribe links — both are one-click,
// no-login GET requests, so both need the same email+token query shape.
export class NewsletterLinkQueryDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  token!: string;
}
