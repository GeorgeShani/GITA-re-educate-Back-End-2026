import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ADMIN_ROLES } from '../common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { FindReviewsAdminDto } from './dto/find-reviews-admin.dto';
import { ReplyToReviewDto } from './dto/reply-to-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('admin-reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.commerce)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({
    summary: 'The moderation queue — every review, filterable by status',
  })
  findAll(@Query() query: FindReviewsAdminDto) {
    return this.reviewsService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Review detail' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.reviewsService.findByIdAdmin(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a review — recomputes the product rating' })
  approve(@Param('id', ParseObjectIdPipe) id: string) {
    return this.reviewsService.approve(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a review' })
  reject(@Param('id', ParseObjectIdPipe) id: string) {
    return this.reviewsService.reject(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/reply')
  @ApiOperation({ summary: 'Post an admin reply on a review' })
  reply(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ReplyToReviewDto,
  ) {
    return this.reviewsService.reply(id, dto.reply);
  }
}
