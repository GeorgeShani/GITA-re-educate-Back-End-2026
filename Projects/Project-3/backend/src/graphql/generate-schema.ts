import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSchemaSdl, SCHEMA_FILE } from './schema-sdl.js';

/** `npm run graphql:schema` → `node dist/graphql/generate-schema.js`. Rewrites the committed schema. */
await writeFile(resolve(SCHEMA_FILE), await buildSchemaSdl(), 'utf8');
process.stdout.write(`Wrote ${SCHEMA_FILE}\n`);
