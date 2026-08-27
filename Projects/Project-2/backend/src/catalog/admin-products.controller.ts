import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { AdminProductsService } from './admin-products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsAdminDto } from './dto/find-products-admin.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('admin-products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.catalog)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly adminProductsService: AdminProductsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List every product, including drafts (SCOPE.md Phase 6 "Products")',
  })
  findAll(@Query() query: FindProductsAdminDto) {
    return this.adminProductsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Product detail, including unpublished drafts' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminProductsService.findById(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Create a product (draft unless publish: true)' })
  create(@Body() dto: CreateProductDto) {
    return this.adminProductsService.create(dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product — set publish: true/false to publish/unpublish',
  })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.adminProductsService.update(id, dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product — must be unpublished first',
  })
  async delete(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.adminProductsService.delete(id);
  }
}
