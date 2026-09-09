import mongoose from 'mongoose';

import { mockOf } from '../../test/support/mock';
import { MongoTestContext } from '../../test/support/mongo-memory-server';
import { getTestModel } from '../../test/support/test-model';
import type { SearchProvider } from '@/search/search-provider.interface';
import { CategoriesService } from './categories.service';
import { ProductsService } from './products.service';
import {
  Category,
  CategoryDocument,
  CategorySchema,
} from './schemas/category.schema';
import {
  Product,
  ProductDocument,
  ProductSchema,
} from './schemas/product.schema';

// Regression cover for category-descendant browsing, which was silently
// broken: buildFilter matched categoryId exactly, so browsing a parent
// returned only products filed directly on it, and the controller's
// work-around ran one paginated query PER descendant and concatenated the
// results — meaning page 1 of a 3-child category returned up to 3x `take`
// items, and sorting was per-subquery rather than global.
//
// The whole point is that pagination and sorting only work if the expansion
// happens inside the same query, so that is what these tests pin down.
const searchProvider = mockOf<SearchProvider>({
  searchProducts: () => Promise.resolve({ productIds: [], total: 0 }),
  typeahead: () => Promise.resolve([]),
});

describe('ProductsService category filtering (integration)', () => {
  let ctx: MongoTestContext;
  let productModel: mongoose.Model<ProductDocument>;
  let categoryModel: mongoose.Model<CategoryDocument>;
  let service: ProductsService;

  let apparelId: string;
  let polosId: string;
  let rainwearId: string;

  beforeAll(async () => {
    ctx = await MongoTestContext.start();
    productModel = getTestModel<ProductDocument>(Product.name, ProductSchema);
    categoryModel = getTestModel<CategoryDocument>(
      Category.name,
      CategorySchema,
    );
    service = new ProductsService(
      productModel,
      searchProvider,
      new CategoriesService(categoryModel),
    );
  }, 120_000);

  beforeEach(async () => {
    // Apparel
    //   ├── Polos
    //   └── Rainwear
    const apparel = await categoryModel.create({
      name: 'Apparel',
      slug: 'apparel',
      path: '/',
    });
    apparel.path = `/${apparel.id}/`;
    await apparel.save();
    apparelId = apparel.id;

    const polos = await categoryModel.create({
      name: 'Polos',
      slug: 'polos',
      parentId: apparel._id,
      path: '/',
    });
    polos.path = `/${apparel.id}/${polos.id}/`;
    await polos.save();
    polosId = polos.id;

    const rainwear = await categoryModel.create({
      name: 'Rainwear',
      slug: 'rainwear',
      parentId: apparel._id,
      path: '/',
    });
    rainwear.path = `/${apparel.id}/${rainwear.id}/`;
    await rainwear.save();
    rainwearId = rainwear.id;

    // Prices are deliberately interleaved across the three categories so a
    // per-subquery sort would produce a visibly wrong global order.
    const fixtures: [string, string, number][] = [
      [apparelId, 'apparel-a', 1000],
      [apparelId, 'apparel-b', 4000],
      [polosId, 'polo-a', 2000],
      [polosId, 'polo-b', 5000],
      [polosId, 'polo-c', 8000],
      [rainwearId, 'rain-a', 3000],
      [rainwearId, 'rain-b', 6000],
      [rainwearId, 'rain-c', 7000],
    ];
    await productModel.create(
      fixtures.map(([categoryId, slug, basePriceMinor], index) => ({
        name: slug,
        slug,
        description: 'Test fixture.',
        brand: index % 2 === 0 ? 'Titleist' : 'Callaway',
        categoryId: new mongoose.Types.ObjectId(categoryId),
        basePriceMinor,
        variants: [{ sku: `${slug}-sku`, attributes: {}, isActive: true }],
        publishedAt: new Date(),
      })),
    );
  });

  afterEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.stop();
  });

  it('returns products from descendant categories, not just direct children', async () => {
    const result = await service.findAll({ category: apparelId });

    // 2 filed directly on Apparel + 3 Polos + 3 Rainwear.
    expect(result.total).toBe(8);
    expect(result.items).toHaveLength(8);
  });

  it('still scopes correctly to a leaf category', async () => {
    const result = await service.findAll({ category: polosId });

    expect(result.total).toBe(3);
    expect(result.items.map((p) => p.slug).sort()).toEqual([
      'polo-a',
      'polo-b',
      'polo-c',
    ]);
  });

  it('honours take across the whole descendant set rather than per subcategory', async () => {
    const page1 = await service.findAll({ category: apparelId, take: 5 });

    // The bug returned up to take x (number of descendants) here.
    expect(page1.items).toHaveLength(5);
    expect(page1.total).toBe(8);
  });

  it('paginates without dropping or duplicating across pages', async () => {
    const take = 5;
    const page1 = await service.findAll({ category: apparelId, take, page: 1 });
    const page2 = await service.findAll({ category: apparelId, take, page: 2 });

    expect(page2.items).toHaveLength(3);

    const slugs = [...page1.items, ...page2.items].map((p) => p.slug);
    expect(new Set(slugs).size).toBe(8); // no duplicates
    expect(slugs.sort()).toEqual([
      'apparel-a',
      'apparel-b',
      'polo-a',
      'polo-b',
      'polo-c',
      'rain-a',
      'rain-b',
      'rain-c',
    ]);
  });

  it('sorts globally across descendants, not within each one', async () => {
    const result = await service.findAll({
      category: apparelId,
      sort: 'price',
      order: 'asc',
    });

    const prices = result.items.map((p) => p.basePriceMinor);
    expect(prices).toEqual([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]);
    // Concatenating per-category sorts would have grouped by category
    // instead — Apparel's two, then Polos' three, then Rainwear's three.
    expect(prices).not.toEqual([
      1000, 4000, 2000, 5000, 8000, 3000, 6000, 7000,
    ]);
  });

  it('computes facets over the same descendant set the list returns', async () => {
    const facets = await service.getFacets(apparelId);

    const total = facets.brands.reduce((sum, row) => sum + row.count, 0);
    expect(total).toBe(8);
    expect(facets.priceRange).toEqual({ min: 1000, max: 8000 });
  });
});
