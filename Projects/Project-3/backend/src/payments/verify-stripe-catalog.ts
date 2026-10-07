import '#/load-env.js';
import { loadConfig } from '#/config/load-config.js';
import { verifyStripeCatalog } from './stripe-catalog.js';
import { fetchStripeCatalog } from './stripe-catalog-fetch.js';

async function main(): Promise<void> {
  verifyStripeCatalog(await fetchStripeCatalog(loadConfig()));
  process.stdout.write('Stripe catalog verified.\n');
}

await main();
