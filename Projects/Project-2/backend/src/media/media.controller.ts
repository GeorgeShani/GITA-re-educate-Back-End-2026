import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { RegisterMediaDto } from './dto/register-media.dto';
import { UploadSignatureQueryDto } from './dto/upload-signature-query.dto';
import { MediaService } from './media.service';

// Gated behind auth for both endpoints — S6's scope is avatars and
// review photos, both of which require being a signed-in user. There's
// no anonymous/guest upload surface in this slice.
@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('upload-signature')
  @ApiOperation({
    summary: 'Get a signed Cloudinary upload payload for direct browser upload',
  })
  getUploadSignature(@Query() query: UploadSignatureQueryDto) {
    return this.mediaService.getUploadSignature(query.ownerContext);
  }

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({
    summary:
      'Register an asset the client just uploaded directly to Cloudinary',
  })
  register(
    @Body() dto: RegisterMediaDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.mediaService.register(dto.publicId, dto.ownerContext, userId);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an asset you uploaded' })
  async delete(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.mediaService.delete(id, userId);
  }
}
