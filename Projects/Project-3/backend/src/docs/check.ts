import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import { buildMergedDocument } from './build-document.js';

/**
 * `npm run docs:check` -> `node dist/docs/check.js`. For CI: regenerates the
 * document in memory and diffs it against the committed `docs/openapi.yaml`
 * — in Node, reading both YAML strings and comparing them, never by shelling
 * out to `diff`/`git diff --exit-code`, which would need Node + a shell +
 * git all agreeing on line endings.
 */
async function main(): Promise<void> {
  const { document, missingProse } = await buildMergedDocument();

  if (missingProse.length > 0) {
    console.error('docs:check failed — missing prose for:');
    for (const operationId of missingProse) {
      console.error(`  - ${operationId}`);
    }
    process.exitCode = 1;
    return;
  }

  const committedPath = join(process.cwd(), 'docs', 'openapi.yaml');
  if (!existsSync(committedPath)) {
    console.error('docs:check failed — docs/openapi.yaml does not exist. Run `npm run docs:generate`.');
    process.exitCode = 1;
    return;
  }

  const committed = readFileSync(committedPath, 'utf8');
  const regenerated = dump(document);

  if (committed !== regenerated) {
    console.error(
      'docs:check failed — docs/openapi.yaml is stale. Run `npm run docs:generate` and commit the result.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('docs/openapi.yaml is up to date.');
}

await main();
