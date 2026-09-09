import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import {
  MAX_PRODUCT_PHOTOS_PER_UPLOAD,
  PHOTO_UPLOAD_OPTIONS,
} from '../common/constants/upload.constant';
import { ActiveSubscriptionGuard } from '../common/guards/active-subscription.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { RequestWithSubscription } from '../common/interfaces/request-with-subscription.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @UseGuards(ActiveSubscriptionGuard)
  @Get()
  findAll(
    @Query() query: FindProductsDto,
    @Req() request: RequestWithSubscription,
  ) {
    return this.productsService.findAll(
      query,
      request.hasActiveSubscription ?? false,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }

  /**
   * Adds one or more photos to the product's gallery. A single-file upload
   * and a multi-file upload are the same request — the client sends 1..N
   * files under the "photos" field — so there's deliberately only one
   * endpoint here instead of separate single/multiple routes.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post(':id/photos')
  @UseInterceptors(
    FilesInterceptor(
      'photos',
      MAX_PRODUCT_PHOTOS_PER_UPLOAD,
      PHOTO_UPLOAD_OPTIONS,
    ),
  )
  addPhotos(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException(
        'No photo files provided (expected multipart field "photos")',
      );
    }

    return this.productsService.addPhotos(id, files);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Delete(':id/photos/:photoId')
  removePhoto(
    @Param('id', ParseIntPipe) id: number,
    @Param('photoId', ParseIntPipe) photoId: number,
  ) {
    return this.productsService.removePhoto(id, photoId);
  }
}
