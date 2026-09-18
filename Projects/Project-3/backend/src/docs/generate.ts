import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import { buildMergedDocument } from './build-document.js';
import { splitByTag } from './split-by-tag.js';

/**
 * `npm run docs:generate` -> `node dist/docs/generate.js`.
 *
 * Fails on any operation with no prose entry — a new endpoint cannot ship
 * undocumented — naming exactly which `operationId` is missing, so the
 * fix is always "add one YAML entry", never "go read the diff".
 */
async function main(): Promise<void> {
  const { document, missingProse } = await buildMergedDocument();

  if (missingProse.length > 0) {
    console.error('docs:generate failed — missing prose for:');
    for (const operationId of missingProse) {
      console.error(`  - ${operationId}`);
    }
    console.error('Add an entry to docs/descriptions/<tag>.yaml for each.');
    process.exitCode = 1;
    return;
  }

  const docsDir = join(process.cwd(), 'docs');
  const perTagDir = join(docsDir, 'openapi');
  if (!existsSync(perTagDir)) mkdirSync(perTagDir, { recursive: true });

  writeFileSync(join(docsDir, 'openapi.yaml'), dump(document), 'utf8');

  for (const [tag, tagDocument] of splitByTag(document)) {
    writeFileSync(join(perTagDir, `${tag}.yaml`), dump(tagDocument), 'utf8');
  }

  console.log(`Wrote docs/openapi.yaml (${Object.keys(document.paths).length} paths).`);
}

await main();
