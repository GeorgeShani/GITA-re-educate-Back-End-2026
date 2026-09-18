import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { OpenAPIObject, OperationObject } from '@nestjs/swagger';
import { load } from 'js-yaml';

export interface ProseEntry {
  summary?: string;
  description?: string;
}

/** Every HTTP method OpenAPI's PathItemObject can carry an operation under. */
const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

const DESCRIPTIONS_DIR = join(process.cwd(), 'docs', 'descriptions');

function isProseEntry(value: unknown): value is ProseEntry {
  return typeof value === 'object' && value !== null;
}

function loadProseMap(): Map<string, ProseEntry> {
  const map = new Map<string, ProseEntry>();
  const files = readdirSync(DESCRIPTIONS_DIR).filter((file) => file.endsWith('.yaml'));

  for (const file of files) {
    const raw = readFileSync(join(DESCRIPTIONS_DIR, file), 'utf8');
    const parsed: unknown = load(raw);
    if (typeof parsed !== 'object' || parsed === null) continue;

    for (const [operationId, entry] of Object.entries(parsed)) {
      if (isProseEntry(entry)) {
        map.set(operationId, entry);
      }
    }
  }

  return map;
}

function operationsOf(document: OpenAPIObject): OperationObject[] {
  const operations: OperationObject[] = [];

  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation) operations.push(operation);
    }
  }

  return operations;
}

/**
 * Merges prose into `document` IN PLACE and returns every `operationId` with
 * no matching entry. `docs:generate` treats a non-empty return as fatal — a
 * new endpoint cannot ship undocumented. Keeping prose in
 * `docs/descriptions/*.yaml` rather than inline `@ApiOperation({ description })`
 * means controllers stay readable and the copy can be edited in one sitting
 * with the whole API in view.
 */
export function mergeProse(document: OpenAPIObject): string[] {
  const prose = loadProseMap();
  const missing: string[] = [];

  for (const operation of operationsOf(document)) {
    const operationId = operation.operationId;
    if (!operationId) continue; // operationIdFactory always sets one; defensive only.

    const entry = prose.get(operationId);
    if (!entry) {
      missing.push(operationId);
      continue;
    }

    if (entry.summary) operation.summary = entry.summary;
    if (entry.description) operation.description = entry.description;
  }

  return missing;
}
