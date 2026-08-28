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

import { ADMIN_ROLES } from '@/common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { RegisterProductMediaDto } from './dto/register-product-media.dto';
import { MediaService } from './media.service';

// The admin path onto S6's signed-upload flow — MEDIA_OWNER_CONTEXTS
// deliberately doesn't include 'product' (see media-owner-context.ts),
// so this is the only place a 'product' upload signature is ever issued,
// and it's role-gated rather than open to any authenticated user like
// MediaController's routes are.
@ApiTags('admin-media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.catalog)
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @ApiOperation({ summary: 'Browse every uploaded asset, not just your own' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.mediaService.findAll(query);
  }

  @Get('upload-signature')
  @ApiOperation({
    summary: 'Signed upload payload for a product image',
  })
  getUploadSignature() {
    return this.mediaService.getUploadSignature('product');
  }

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({
    summary:
      'Register a product image the client just uploaded directly to Cloudinary — attach it to a product via PATCH /admin/products/:id',
  })
  register(
    @Body() dto: RegisterProductMediaDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.mediaService.register(dto.publicId, 'product', userId);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete any asset, not just the caller's own" })
  async delete(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.mediaService.adminDelete(id, userId);
  }
}
