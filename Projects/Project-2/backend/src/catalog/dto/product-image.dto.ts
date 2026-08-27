import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

// Mirrors catalog/schemas/product.schema.ts's embedded ProductImage
// shape — admin upload flow: sign via AdminMediaController, upload
// client-side, then pass the Cloudinary metadata back here on
// create/update, same two-step pattern S6 already established for
// avatars/review photos.
export class ProductImageDto {
  @ApiProperty()
  @IsString()
  publicId!: string;

  @ApiProperty()
  @IsString()
  url!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  width!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  height!: number;

  @ApiProperty()
  @IsString()
  alt!: string;

  @ApiProperty({ default: 0 })
  @IsInt()
  @Min(0)
  position!: number;
}
