/**
 * Replaces product and category photos with golf-relevant ones.
 *
 * The catalogue seed took the first unused Pexels hit for each product's
 * query with no relevance check, which put a pool table on a yardage wheel,
 * medical latex gloves on golf gloves, and a diamond ring on a leather glove.
 * This script only accepts a photo whose own Pexels description mentions
 * golf, then prefers the one that also names the specific item (glove, tee,
 * umbrella...), and never uses the same photo twice.
 *
 *   npm run images:refresh -- --dry-run      print the picks, change nothing
 *   npm run images:refresh                   upload + update, writes a backup
 *   npm run images:refresh -- --restore <backup.json>
 *
 * New uploads get new Cloudinary public ids (suffix "-golf"), so the old
 * assets are left untouched and a restore is just writing the old URLs back.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';

import { CategorySchema } from '../src/catalog/schemas/category.schema';
import { ProductSchema } from '../src/catalog/schemas/product.schema';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

type Orientation = 'portrait' | 'landscape' | 'square';

interface PexelsPhoto {
  id: number;
  photographer_id: number;
  alt: string;
  src: { large2x: string };
}

interface Pick {
  photo: PexelsPhoto;
  query: string;
  score: number;
}

interface Term {
  term: string;
  match: RegExp;
}

// ---------------------------------------------------------------- keywords

/**
 * Ordered, most specific first. Each rule maps a product name to the term
 * searched as "golf <term>" and the word a photo description must contain
 * to count as an exact match.
 */
const NAME_RULES: { test: RegExp; term: string; match: RegExp }[] = [
  { test: /glove/i, term: 'glove', match: /glove/i },
  { test: /retriever/i, term: 'ball water hazard', match: /ball|water|pond/i },
  { test: /marker/i, term: 'ball marker green', match: /marker|ball/i },
  { test: /golf balls?|\bballs\b/i, term: 'ball', match: /ball/i },
  { test: /\btees?\b/i, term: 'tee', match: /\btee/i },
  { test: /headcover/i, term: 'club headcover', match: /headcover|club/i },
  { test: /towel/i, term: 'towel', match: /towel/i },
  { test: /rain cover/i, term: 'bag rain', match: /bag|rain/i },
  { test: /\bbag\b|travel cover/i, term: 'bag', match: /\bbag/i },
  {
    test: /watch|charging|silicone band/i,
    term: 'smartwatch',
    match: /watch/i,
  },
  {
    test: /rangefinder|gps|voice\+/i,
    term: 'rangefinder distance',
    match: /rangefinder|distance|flag/i,
  },
  { test: /polo|shirt|mock neck/i, term: 'polo shirt', match: /shirt|polo/i },
  {
    test: /jacket|pullover|quarter-zip|vest|windbreaker|base layer/i,
    term: 'jacket',
    match: /jacket|sweater|pullover|vest/i,
  },
  {
    test: /shorts|trousers|joggers|skort/i,
    term: 'outfit',
    match: /outfit|pants|shorts|skirt|attire/i,
  },
  {
    test: /\bhat\b|\bcap\b|visor/i,
    term: 'cap hat',
    match: /\bcap\b|\bhat\b|visor/i,
  },
  { test: /belt|socks/i, term: 'shoes outfit', match: /shoe|outfit|attire/i },
  { test: /umbrella/i, term: 'umbrella', match: /umbrella/i },
  { test: /divot/i, term: 'green divot', match: /green|divot/i },
  {
    test: /scorecard|pencil|yardage book/i,
    term: 'scorecard',
    match: /scorecard|score|card|pencil/i,
  },
  {
    test: /brush|cleaning|multi-tool/i,
    term: 'clubs irons',
    match: /club|iron/i,
  },
  { test: /wheel|yardage/i, term: 'course fairway', match: /course|fairway/i },
  { test: /putt|mirror|\bmat\b/i, term: 'putting green', match: /putt/i },
  { test: /swing|tempo/i, term: 'swing', match: /swing/i },
  {
    test: /stick|alignment/i,
    term: 'practice range',
    match: /practice|range|training/i,
  },
  {
    test: /\bnet\b|chipping|impact/i,
    term: 'chipping practice',
    match: /chip|practice|training/i,
  },
];

const CATEGORY_TERMS: Record<string, Term> = {
  gloves: { term: 'glove', match: /glove/i },
  'golf-balls': { term: 'balls', match: /ball/i },
  tees: { term: 'tee', match: /\btee/i },
  headcovers: { term: 'clubs bag', match: /club/i },
  towels: { term: 'bag clubs', match: /bag|club/i },
  bags: { term: 'bag', match: /\bbag/i },
  'rangefinders-gps': { term: 'course flag', match: /flag|course/i },
  apparel: { term: 'golfer outfit', match: /golfer|outfit|attire/i },
  'training-aids': {
    term: 'practice range',
    match: /practice|range|training/i,
  },
  accessories: { term: 'equipment', match: /equipment|bag|club|ball/i },
};

const FALLBACK_TERMS = ['golfer', 'course'];

const FALLBACK_ORIENTATIONS: Orientation[] = ['square', 'landscape'];

// ---------------------------------------------------------------- pexels

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPexelsPhoto(value: unknown): value is PexelsPhoto {
  if (!isRecord(value)) return false;
  const src = value['src'];
  return (
    typeof value['id'] === 'number' &&
    typeof value['photographer_id'] === 'number' &&
    typeof value['alt'] === 'string' &&
    isRecord(src) &&
    typeof src['large2x'] === 'string'
  );
}

const searchCache = new Map<string, PexelsPhoto[]>();

async function search(
  query: string,
  orientation: Orientation,
  page: number,
): Promise<PexelsPhoto[]> {
  const key = `${orientation}|${page}|${query}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error('PEXELS_API_KEY is not set in .env');

  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '80');
  url.searchParams.set('page', String(page));
  url.searchParams.set('orientation', orientation);

  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok)
    throw new Error(`Pexels search "${query}" failed: ${res.status}`);

  const body: unknown = await res.json();
  const raw = isRecord(body) ? body['photos'] : undefined;
  const photos = Array.isArray(raw) ? raw.filter(isPexelsPhoto) : [];
  searchCache.set(key, photos);
  return photos;
}

const usedPhotoIds = new Set<number>();

/**
 * Descriptions that mention golf but aren't photos of the game or its gear.
 * Found in the dry run: a birthday cake shaped like a golf cap, a barrel in
 * a bunker, a course direction sign, and novelty/mini-golf shots.
 */
const DENY =
  /\b(cake|birthday|toy|cartoon|illustration|drawing|mini ?golf|miniature|barrel|sign|damaged|logo)\b/i;

/**
 * Walks the candidate queries in order and returns the best unused photo:
 * a golf photo that names the item (score 3) beats one that names the
 * category (2), which beats any golf photo at all (1). Stops early on an
 * exact match so the most specific query wins.
 *
 * Within one grid (a category's products, or the home page's category
 * tiles) a photographer who is already on it only wins a tie. Distinct
 * Pexels ids aren't enough: one shoot uploads as many ids, which put two
 * near-identical ball piles side by side in Golf Balls, and the same golfer
 * twice in Towels. An exact item match from a repeat photographer still
 * beats a looser match from a new one.
 */
async function choose(
  terms: Term[],
  orientation: Orientation,
  gridPhotographers: Set<number>,
): Promise<Pick | null> {
  let best: Pick | null = null;
  const primary = terms[0];
  const secondary = terms[1];
  const rank = (pick: Pick): number =>
    pick.score * 2 +
    (gridPhotographers.has(pick.photo.photographer_id) ? 0 : 1);
  const IDEAL = 7; // exact match (3) from a photographer new to this grid

  for (const { term } of terms) {
    const query = `golf ${term}`;
    for (const page of [1, 2]) {
      const photos = await search(query, orientation, page);
      for (const photo of photos) {
        if (
          usedPhotoIds.has(photo.id) ||
          !/golf/i.test(photo.alt) ||
          DENY.test(photo.alt)
        )
          continue;
        const score = primary?.match.test(photo.alt)
          ? 3
          : secondary?.match.test(photo.alt)
            ? 2
            : 1;
        const candidate = { photo, query, score };
        if (!best || rank(candidate) > rank(best)) best = candidate;
        if (rank(best) === IDEAL) break;
      }
      if (best && rank(best) >= 5) break;
      if (photos.length < 80) break;
    }
    if (best && rank(best) === IDEAL) break;
  }

  // Portrait results for a narrow item run out fast (11 glove products drain
  // the portrait "golf glove" pool), which left fallbacks like two near-
  // identical shots from one fashion shoot on neighbouring glove cards. Before
  // settling for a photo that doesn't show the item, look in the other
  // orientations: the card cover-crops to 3:4, and item close-ups keep their
  // subject centred. Landscape is where most of them are (21 exact glove
  // matches vs 0 square, checked against the API). Pexels partitions results
  // by orientation, and category tiles are picked first, so this can neither
  // steal a later portrait pick nor duplicate a category photo.
  if (orientation === 'portrait' && primary && (!best || rank(best) < IDEAL)) {
    const query = `golf ${primary.term}`;
    lookup: for (const other of FALLBACK_ORIENTATIONS) {
      for (const page of [1, 2]) {
        const photos = await search(query, other, page);
        const exact = photos.filter(
          (photo) =>
            !usedPhotoIds.has(photo.id) &&
            /golf/i.test(photo.alt) &&
            !DENY.test(photo.alt) &&
            primary.match.test(photo.alt),
        );
        const fresh = exact.find(
          (photo) => !gridPhotographers.has(photo.photographer_id),
        );
        // A repeat photographer is only worth taking over a non-exact pick.
        const found = fresh ?? (best?.score === 3 ? undefined : exact[0]);
        if (found) {
          best = { photo: found, query: `${query} (${other})`, score: 3 };
          if (fresh) break lookup;
        }
        if (photos.length < 80) break;
      }
    }
  }

  if (best) {
    usedPhotoIds.add(best.photo.id);
    gridPhotographers.add(best.photo.photographer_id);
  }
  return best;
}

function termsForProduct(name: string, categorySlug: string): Term[] {
  const terms: Term[] = [];
  const rule = NAME_RULES.find((r) => r.test.test(name));
  if (rule) terms.push({ term: rule.term, match: rule.match });
  const category = CATEGORY_TERMS[categorySlug];
  if (category) terms.push(category);
  for (const term of FALLBACK_TERMS) terms.push({ term, match: /golf/i });
  return terms;
}

// ---------------------------------------------------------------- upload

async function upload(photo: PexelsPhoto, folder: string, publicId: string) {
  const result = await cloudinary.uploader.upload(photo.src.large2x, {
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

async function inBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

// ---------------------------------------------------------------- main

interface Backup {
  createdAt: string;
  products: Record<string, unknown>;
  categories: Record<string, unknown>;
}

function isBackup(value: unknown): value is Backup {
  return (
    isRecord(value) &&
    typeof value['createdAt'] === 'string' &&
    isRecord(value['products']) &&
    isRecord(value['categories'])
  );
}

async function restore(file: string): Promise<void> {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!isBackup(parsed)) throw new Error(`${file} is not an image backup`);

  const ProductModel = mongoose.model('Product', ProductSchema);
  const CategoryModel = mongoose.model('Category', CategorySchema);
  for (const [slug, images] of Object.entries(parsed.products)) {
    await ProductModel.updateOne({ slug }, { $set: { images } });
  }
  for (const [slug, imageUrl] of Object.entries(parsed.categories)) {
    await CategoryModel.updateOne(
      { slug },
      typeof imageUrl === 'string'
        ? { $set: { imageUrl } }
        : { $unset: { imageUrl: '' } },
    );
  }
  console.log(
    `Restored ${Object.keys(parsed.products).length} products and ` +
      `${Object.keys(parsed.categories).length} categories from ${file}`,
  );
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set in .env');
  await mongoose.connect(mongoUri);

  const restoreIndex = process.argv.indexOf('--restore');
  if (restoreIndex !== -1) {
    const file = process.argv[restoreIndex + 1];
    if (!file) throw new Error('--restore needs a backup file path');
    await restore(file);
    return;
  }

  const dryRun = process.argv.includes('--dry-run');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const ProductModel = mongoose.model('Product', ProductSchema);
  const CategoryModel = mongoose.model('Category', CategorySchema);
  const categories = await CategoryModel.find().lean().exec();
  const products = await ProductModel.find().sort({ name: 1 }).lean().exec();
  const slugByCategoryId = new Map(
    categories.map((c) => [String(c._id), c.slug]),
  );

  // Categories first so their tiles get the strongest pick for each theme.
  const categoryPicks: { slug: string; pick: Pick }[] = [];
  const tilePhotographers = new Set<number>();
  for (const category of categories) {
    const course: Term = { term: 'course', match: /course/i };
    const term = CATEGORY_TERMS[category.slug];
    const pick = await choose(
      term ? [term, course] : [course],
      'landscape',
      tilePhotographers,
    );
    if (pick) categoryPicks.push({ slug: category.slug, pick });
    console.log(
      `category ${category.slug.padEnd(18)} [${pick?.score ?? '-'}] ${pick ? pick.photo.alt.slice(0, 80) : 'NO PICK'}`,
    );
  }

  const productPicks: { slug: string; name: string; pick: Pick }[] = [];
  const photographersByCategory = new Map<string, Set<number>>();
  for (const product of products) {
    const categorySlug = slugByCategoryId.get(String(product.categoryId)) ?? '';
    const gridPhotographers =
      photographersByCategory.get(categorySlug) ?? new Set<number>();
    photographersByCategory.set(categorySlug, gridPhotographers);
    const pick = await choose(
      termsForProduct(product.name, categorySlug),
      'portrait',
      gridPhotographers,
    );
    if (pick)
      productPicks.push({ slug: product.slug, name: product.name, pick });
    console.log(
      `product  ${product.name.slice(0, 34).padEnd(34)} [${pick?.score ?? '-'}] ${pick ? pick.photo.alt.slice(0, 70) : 'NO PICK'}`,
    );
  }

  const exact = productPicks.filter((p) => p.pick.score === 3).length;
  console.log(
    `\n${productPicks.length}/${products.length} products picked (${exact} name the exact item), ` +
      `${categoryPicks.length}/${categories.length} categories.`,
  );
  if (dryRun) {
    console.log('Dry run — nothing uploaded or changed.');
    return;
  }

  const backupDir = join('scripts', '.backups');
  mkdirSync(backupDir, { recursive: true });
  const createdAt = new Date().toISOString();
  const backup: Backup = {
    createdAt,
    products: Object.fromEntries(products.map((p) => [p.slug, p.images])),
    categories: Object.fromEntries(
      categories.map((c) => [c.slug, c.imageUrl ?? null]),
    ),
  };
  const backupFile = join(
    backupDir,
    `images-${createdAt.replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupFile}`);

  let done = 0;
  await inBatches(categoryPicks, 4, async ({ slug, pick }) => {
    const uploaded = await upload(
      pick.photo,
      'dev/categories',
      `category-${slug}-golf`,
    );
    await CategoryModel.updateOne(
      { slug },
      { $set: { imageUrl: uploaded.url } },
    );
    done += 1;
  });
  console.log(`Categories updated: ${done}`);

  done = 0;
  await inBatches(productPicks, 4, async ({ slug, name, pick }) => {
    const uploaded = await upload(
      pick.photo,
      'dev/products',
      `product-${slug}-golf`,
    );
    await ProductModel.updateOne(
      { slug },
      { $set: { images: [{ ...uploaded, alt: name, position: 0 }] } },
    );
    done += 1;
    if (done % 20 === 0)
      console.log(`  products updated: ${done}/${productPicks.length}`);
  });
  console.log(`Products updated: ${done}.`);
  console.log(
    `Restore with: npm run images:refresh -- --restore ${backupFile}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
