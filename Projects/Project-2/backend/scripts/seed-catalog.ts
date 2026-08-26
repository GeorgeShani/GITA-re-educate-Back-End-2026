// SCOPE.md Phase 3 — "the seed script is the only way products come into
// existence" (no admin CRUD in scope for this backend). Run with:
//   npm run seed:catalog
//
// Requires MONGODB_URI, CLOUDINARY_*, and PEXELS_API_KEY in .env — see
// the storefront backend plan's secrets guide. Idempotent: re-running
// upserts by slug/sku rather than duplicating, so it's safe to run
// again after adding a product to the seed data.
import { existsSync } from 'node:fs';

import mongoose, { Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

import { CategorySchema } from '../src/catalog/schemas/category.schema';
import {
  ProductSchema,
  ProductImage,
  ProductVariant,
} from '../src/catalog/schemas/product.schema';
import { InventoryItemSchema } from '../src/inventory/schemas/inventory-item.schema';
import { CATEGORY_SEEDS } from './seed-data/categories';
import { PRODUCT_SEEDS, ProductSeed } from './seed-data/products';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const PEXELS_DELAY_MS = 300; // stay well clear of the 200/hour free-tier limit
const MIN_STOCK = 15;
const MAX_STOCK = 120;

interface PexelsPhoto {
  src: { large: string };
  url: string;
  photographer: string;
}

async function searchPexels(query: string): Promise<PexelsPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error('PEXELS_API_KEY is not set in .env');
  }

  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '1');
  url.searchParams.set('orientation', 'square');

  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    throw new Error(`Pexels search failed for "${query}": ${res.status}`);
  }

  const json = (await res.json()) as { photos: PexelsPhoto[] };
  return json.photos[0] ?? null;
}

async function uploadFromPexels(
  query: string,
  publicId: string,
  folder: string,
): Promise<{ publicId: string; url: string; width: number; height: number }> {
  const photo = await searchPexels(query);
  if (!photo) {
    throw new Error(`No Pexels result for "${query}"`);
  }

  // Cloudinary fetches the remote URL server-side — no local temp file
  // needed, unlike the frontend's fetch-pexels-images.mjs (which saves
  // locally because it's populating a checked-in public/ folder, not
  // uploading to Cloudinary).
  const result = await cloudinary.uploader.upload(photo.src.large, {
    folder,
    public_id: publicId,
    overwrite: true,
  });

  return {
    publicId: result.public_id,
    url: result.secure_url,
    width: result.width,
    height: result.height,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomStock(): number {
  return Math.floor(Math.random() * (MAX_STOCK - MIN_STOCK + 1)) + MIN_STOCK;
}

async function seedCategories(
  CategoryModel: mongoose.Model<unknown>,
  env: string,
): Promise<Map<string, Types.ObjectId>> {
  const idBySlug = new Map<string, Types.ObjectId>();

  for (const [index, seed] of CATEGORY_SEEDS.entries()) {
    console.log(
      `[category ${index + 1}/${CATEGORY_SEEDS.length}] ${seed.name}`,
    );

    const image = await uploadFromPexels(
      seed.imageQuery,
      `category-${seed.slug}`,
      `${env}/categories`,
    );
    await sleep(PEXELS_DELAY_MS);

    const doc = await CategoryModel.findOneAndUpdate(
      { slug: seed.slug },
      {
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        parentId: null,
        // No subcategories in this dataset — path is just "/{own id}/"
        // once we know the id, set in a second pass below.
        position: index,
        imageUrl: image.url,
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    const record = doc as unknown as { _id: Types.ObjectId; path?: string };
    if (!record.path) {
      await CategoryModel.updateOne(
        { _id: record._id },
        { path: `/${record._id.toString()}/` },
      ).exec();
    }

    idBySlug.set(seed.slug, record._id);
  }

  return idBySlug;
}

async function seedProduct(
  ProductModel: mongoose.Model<unknown>,
  InventoryItemModel: mongoose.Model<unknown>,
  seed: ProductSeed,
  categoryId: Types.ObjectId,
  env: string,
): Promise<void> {
  const image = await uploadFromPexels(
    seed.imageQuery,
    `product-${seed.slug}`,
    `${env}/products`,
  );
  await sleep(PEXELS_DELAY_MS);

  const images: Partial<ProductImage>[] = [
    {
      publicId: image.publicId,
      url: image.url,
      width: image.width,
      height: image.height,
      alt: seed.name,
      position: 0,
    },
  ];

  const variants: Partial<ProductVariant>[] = seed.variants.map((variant) => ({
    sku: variant.sku,
    attributes: variant.attributes,
    priceMinor: variant.priceMinor,
    isActive: true,
  }));

  const product = await ProductModel.findOneAndUpdate(
    { slug: seed.slug },
    {
      name: seed.name,
      slug: seed.slug,
      brand: seed.brand,
      description: seed.description,
      categoryId,
      basePriceMinor: seed.basePriceMinor,
      images,
      variants,
      tags: seed.tags,
      isFeatured: seed.isFeatured ?? false,
      publishedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  const record = product as unknown as { _id: Types.ObjectId };

  for (const variant of seed.variants) {
    await InventoryItemModel.findOneAndUpdate(
      { productId: record._id, variantSku: variant.sku.toUpperCase() },
      {
        $setOnInsert: {
          productId: record._id,
          variantSku: variant.sku.toUpperCase(),
          quantityOnHand: randomStock(),
          quantityReserved: 0,
          lowStockThreshold: 5,
          backorderAllowed: false,
        },
      },
      { upsert: true },
    ).exec();
  }
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

  const CategoryModel = mongoose.model('Category', CategorySchema);
  const ProductModel = mongoose.model('Product', ProductSchema);
  const InventoryItemModel = mongoose.model(
    'InventoryItem',
    InventoryItemSchema,
  );

  console.log(`\nSeeding ${CATEGORY_SEEDS.length} categories...`);
  const categoryIdBySlug = await seedCategories(CategoryModel, env);

  console.log(`\nSeeding ${PRODUCT_SEEDS.length} products...`);
  let succeeded = 0;
  const failures: { slug: string; error: string }[] = [];

  for (const [index, seed] of PRODUCT_SEEDS.entries()) {
    const categoryId = categoryIdBySlug.get(seed.categorySlug);
    if (!categoryId) {
      failures.push({
        slug: seed.slug,
        error: `Unknown category "${seed.categorySlug}"`,
      });
      continue;
    }

    console.log(`[product ${index + 1}/${PRODUCT_SEEDS.length}] ${seed.name}`);
    try {
      await seedProduct(
        ProductModel,
        InventoryItemModel,
        seed,
        categoryId,
        env,
      );
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAILED: ${message}`);
      failures.push({ slug: seed.slug, error: message });
    }
  }

  console.log(`\nDone. ${succeeded}/${PRODUCT_SEEDS.length} products seeded.`);
  if (failures.length > 0) {
    console.log(`\n${failures.length} failure(s):`);
    for (const failure of failures) {
      console.log(`  - ${failure.slug}: ${failure.error}`);
    }
  }

  await mongoose.disconnect();
  process.exit(failures.length > 0 ? 1 : 0);
}

void main();
