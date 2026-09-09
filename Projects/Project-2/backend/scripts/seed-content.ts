// F9 (Content) — Post/PostCategory/Tag/Page all have no seed data at all
// (unlike catalog/commerce), and Page's own schema comment says "admin
// CRUD is out of scope; these are seeded directly" — so without this
// script, /blog is permanently empty and the footer's already-live
// /pages/shipping, /pages/returns, /pages/faq links 404 forever. Run with:
//   npm run seed:content
//
// Requires MONGODB_URI, CLOUDINARY_*, and PEXELS_API_KEY in .env.
// Idempotent: upserts by slug, safe to re-run after editing seed data.
import { existsSync } from 'node:fs';

import mongoose, { Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

import { PageSchema } from '../src/pages/schemas/page.schema';
import { PostSchema } from '../src/blog/schemas/post.schema';
import { PostCategorySchema } from '../src/blog/schemas/post-category.schema';
import { TagSchema } from '../src/blog/schemas/tag.schema';
import { UserSchema } from '../src/users/schemas/user.schema';
import { PAGE_SEEDS, POST_CATEGORY_SEEDS, POST_SEEDS, TAG_SEEDS } from './seed-data/content';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const PEXELS_DELAY_MS = 300; // stay well clear of the 200/hour free-tier limit

/**
 * Every model in this script is deliberately typed `Model<unknown>` — a
 * raw `mongoose.model(name, schema)` call with no seed-specific document
 * interface to import, since the point is writing ad hoc seed shapes, not
 * going through the app's own DTOs. That leaves a write result's real
 * type as `unknown`; this is the one place that gets narrowed back to
 * "an id and whatever else the caller needs" instead of a cast at each
 * call site below.
 */
function withId<T extends Record<string, unknown> = Record<string, unknown>>(
  doc: unknown,
): { _id: Types.ObjectId } & T {
  return doc as { _id: Types.ObjectId } & T;
}

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
  url.searchParams.set('orientation', 'landscape');

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
): Promise<string> {
  const photo = await searchPexels(query);
  if (!photo) {
    throw new Error(`No Pexels result for "${query}"`);
  }

  const result = await cloudinary.uploader.upload(photo.src.large, {
    folder,
    public_id: publicId,
    overwrite: true,
  });

  return result.secure_url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const PostModel = mongoose.model('Post', PostSchema);
  const PostCategoryModel = mongoose.model('PostCategory', PostCategorySchema);
  const TagModel = mongoose.model('Tag', TagSchema);
  const PageModel = mongoose.model('Page', PageSchema);
  const UserModel = mongoose.model('User', UserSchema);

  // Post.authorId is a required ref to User — PostDto never surfaces an
  // author name publicly (PublicBlogService never populates it), so which
  // real user it points to has no visible effect. Reuses whichever account
  // already exists (this project's test accounts, or a real admin) rather
  // than fabricating a password hash by hand.
  const author = await UserModel.findOne().sort({ createdAt: 1 }).exec();
  if (!author) {
    throw new Error(
      'No users exist yet — register at least one account (or run promote-admin) before seeding content.',
    );
  }
  const authorRecord = withId<{ email: string }>(author);
  const authorId = authorRecord._id;
  console.log(`Using "${authorRecord.email}" as post author.\n`);

  console.log(`Seeding ${POST_CATEGORY_SEEDS.length} post categories...`);
  const categoryIdBySlug = new Map<string, Types.ObjectId>();
  for (const seed of POST_CATEGORY_SEEDS) {
    const doc = await PostCategoryModel.findOneAndUpdate(
      { slug: seed.slug },
      { name: seed.name, slug: seed.slug },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
    categoryIdBySlug.set(seed.slug, withId(doc)._id);
  }

  console.log(`Seeding ${TAG_SEEDS.length} tags...`);
  const tagIdByName = new Map<string, Types.ObjectId>();
  for (const name of TAG_SEEDS) {
    const doc = await TagModel.findOneAndUpdate(
      { name },
      { name },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
    tagIdByName.set(name, withId(doc)._id);
  }

  console.log(`\nSeeding ${POST_SEEDS.length} posts...`);
  let succeeded = 0;
  const failures: { slug: string; error: string }[] = [];

  for (const [index, seed] of POST_SEEDS.entries()) {
    const categoryId = categoryIdBySlug.get(seed.categorySlug);
    if (!categoryId) {
      failures.push({ slug: seed.slug, error: `Unknown category "${seed.categorySlug}"` });
      continue;
    }
    const tagIds = seed.tags.map((tag) => tagIdByName.get(tag)).filter((id): id is Types.ObjectId => !!id);

    console.log(`[post ${index + 1}/${POST_SEEDS.length}] ${seed.title}`);
    try {
      const coverImageUrl = await uploadFromPexels(seed.imageQuery, `post-${seed.slug}`, `${env}/blog`);
      await sleep(PEXELS_DELAY_MS);

      const publishedAt = new Date();
      publishedAt.setDate(publishedAt.getDate() - seed.daysAgo);

      await PostModel.findOneAndUpdate(
        { slug: seed.slug },
        {
          title: seed.title,
          slug: seed.slug,
          excerpt: seed.excerpt,
          body: seed.body,
          coverImageUrl,
          authorId,
          categoryId,
          tagIds,
          publishedAt,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).exec();
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAILED: ${message}`);
      failures.push({ slug: seed.slug, error: message });
    }
  }
  console.log(`Done. ${succeeded}/${POST_SEEDS.length} posts seeded.`);

  console.log(`\nSeeding ${PAGE_SEEDS.length} static pages...`);
  for (const seed of PAGE_SEEDS) {
    await PageModel.findOneAndUpdate(
      { slug: seed.slug },
      {
        title: seed.title,
        slug: seed.slug,
        body: seed.body,
        seoTitle: seed.seoTitle,
        seoDescription: seed.seoDescription,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
  }
  console.log(`Done. ${PAGE_SEEDS.length}/${PAGE_SEEDS.length} pages seeded.`);

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
