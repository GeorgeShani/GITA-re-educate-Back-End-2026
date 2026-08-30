import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { ActiveSubscriptionGuard } from '../common/guards/active-subscription.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { RequestWithSubscription } from '../common/interfaces/request-with-subscription.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
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
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.productsService.remove(id);
  }
}
