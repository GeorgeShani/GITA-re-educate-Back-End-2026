#!/usr/bin/env node
// Fetch product photography from the Pexels API and save it into
// public/images/products/. Free-tier commercial-use license, no
// attribution required — see https://www.pexels.com/license/
//
// Usage:
//   node scripts/fetch-pexels-images.mjs "golf glove" glove-titleist-2
//   node scripts/fetch-pexels-images.mjs "golf glove" glove-titleist-2 --size=large --orientation=square
//
// Reads PEXELS_API_KEY from scripts/.env (gitignored — never commit it).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvKey() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) {
    console.error('Missing scripts/.env — add a line: PEXELS_API_KEY=your-key-here');
    process.exit(1);
  }
  const match = readFileSync(envPath, 'utf8').match(/^PEXELS_API_KEY=(.+)$/m);
  if (!match) {
    console.error('scripts/.env has no PEXELS_API_KEY= line.');
    process.exit(1);
  }
  return match[1].trim();
}

function parseArgs(argv) {
  const [query, outName, ...rest] = argv;
  if (!query || !outName) {
    console.error(
      'Usage: node scripts/fetch-pexels-images.mjs "<search query>" <output-filename-without-ext> [--size=medium|large|large2x|original] [--orientation=square|landscape|portrait]',
    );
    process.exit(1);
  }
  const opts = { size: 'large', orientation: 'square' };
  for (const arg of rest) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key && value) opts[key] = value;
  }
  return { query, outName, ...opts };
}

async function main() {
  const apiKey = loadEnvKey();
  const { query, outName, size, orientation } = parseArgs(process.argv.slice(2));

  const searchUrl = new URL('https://api.pexels.com/v1/search');
  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('per_page', '1');
  searchUrl.searchParams.set('orientation', orientation);

  const searchRes = await fetch(searchUrl, { headers: { Authorization: apiKey } });
  if (!searchRes.ok) {
    console.error(`Pexels search failed: ${searchRes.status} ${await searchRes.text()}`);
    process.exit(1);
  }
  const searchJson = await searchRes.json();
  const photo = searchJson.photos?.[0];
  if (!photo) {
    console.error(`No Pexels results for "${query}".`);
    process.exit(1);
  }

  const imageUrl = photo.src[size] ?? photo.src.large;
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    console.error(`Image download failed: ${imageRes.status}`);
    process.exit(1);
  }
  const buffer = Buffer.from(await imageRes.arrayBuffer());

  const outDir = join(__dirname, '..', 'public', 'images', 'products');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${outName}.jpg`);
  writeFileSync(outPath, buffer);

  console.log(`Saved ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  console.log(`Source: ${photo.url}`);
  console.log(`Photographer: ${photo.photographer} (${photo.photographer_url})`);
}

main();
