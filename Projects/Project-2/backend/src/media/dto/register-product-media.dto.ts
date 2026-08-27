import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RegisterProductMediaDto {
  @ApiProperty({
    description:
      "The public_id Cloudinary returned after the client's direct upload",
  })
  @IsString()
  publicId!: string;
}
