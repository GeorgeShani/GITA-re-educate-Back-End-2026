import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { FindReviewsDto } from './dto/find-reviews.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Approved reviews for a product' })
  findApproved(@Query() query: FindReviewsDto) {
    return this.reviewsService.findApproved(query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({
    summary:
      'Submit a review — verified-purchase status is checked server-side, never trusted from the client',
  })
  submit(@Body() dto: CreateReviewDto, @CurrentUser('userId') userId: string) {
    return this.reviewsService.submit(dto, userId);
  }
}
