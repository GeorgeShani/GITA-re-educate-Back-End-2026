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
import { AdminCategoriesService } from './admin-categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('admin-categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.catalog)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(
    private readonly adminCategoriesService: AdminCategoriesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Every category, flat (not the public tree), including inactive ones',
  })
  findAll() {
    return this.adminCategoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Category detail' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminCategoriesService.findById(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Create a category' })
  create(@Body() dto: CreateCategoryDto) {
    return this.adminCategoriesService.create(dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a category — set parentId to re-parent (move), including drag-reorder',
  })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.adminCategoriesService.update(id, dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a category — blocked while it has subcategories or assigned products',
  })
  async delete(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.adminCategoriesService.delete(id);
  }
}
