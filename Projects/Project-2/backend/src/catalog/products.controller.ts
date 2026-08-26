import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { CategoriesService } from './categories.service';
import { FindProductsDto } from './dto/find-products.dto';
import { ProductsService } from './products.service';

class BatchProductsQueryDto {
  @ApiPropertyOptional({ description: 'Comma-separated product ids' })
  @IsOptional()
  @IsString()
  ids?: string;
}

class TypeaheadQueryDto {
  @ApiPropertyOptional()
  @IsString()
  q!: string;
}

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List products — filterable, sortable, and (with ?q=) full-text searchable',
  })
  async findAll(@Query() query: FindProductsDto) {
    // Category filtering includes descendants — browsing "Apparel"
    // should surface products filed under its subcategories too.
    if (query.category) {
      const descendantIds =
        await this.categoriesService.findSelfAndDescendantIds(query.category);
      if (descendantIds.length > 1) {
        const results = await Promise.all(
          descendantIds.map((id) =>
            this.productsService.findAll({ ...query, category: id.toString() }),
          ),
        );
        const items = results.flatMap((result) => result.items);
        const total = results.reduce((sum, result) => sum + result.total, 0);
        return { items, total, page: query.page ?? 1, take: query.take ?? 30 };
      }
    }

    return this.productsService.findAll(query);
  }

  @Get('facets')
  @ApiOperation({
    summary: 'Brand facet counts and price range for the current filter set',
  })
  getFacets(@Query('category') category?: string) {
    return this.productsService.getFacets(category);
  }

  @Get('typeahead')
  @ApiOperation({ summary: 'Search-box autocomplete suggestions' })
  typeahead(@Query() query: TypeaheadQueryDto) {
    return this.productsService.typeahead(query.q);
  }

  @Get('batch')
  @ApiOperation({
    summary: 'Batch fetch by id — backs a client-tracked recently-viewed list',
  })
  findBatch(@Query() query: BatchProductsQueryDto) {
    const ids = query.ids?.split(',').filter(Boolean) ?? [];
    return this.productsService.findByIds(ids);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Product detail by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get(':slug/related')
  @ApiOperation({ summary: 'Other products in the same category' })
  async findRelated(@Param('slug') slug: string) {
    const product = await this.productsService.findBySlug(slug);
    return this.productsService.findRelated(product);
  }
}
