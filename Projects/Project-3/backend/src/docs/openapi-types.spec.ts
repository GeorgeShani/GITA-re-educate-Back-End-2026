import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

/**
 * Project-2's worst documentation debt: most GETs returned raw Mongoose
 * documents with no response DTO, so their generated OpenAPI schemas came
 * out empty — and an empty schema is exactly what `openapi-typescript` turns
 * into `unknown` (or `Record<string, never>`) in the generated client types,
 * silently degrading the frontend's "typed" API client to `any`-shaped data
 * with no compiler warning anywhere.
 *
 * Generic on purpose: it walks EVERY operation in the committed
 * `docs/openapi.yaml`, so a route added in any later phase is covered without
 * anyone remembering to extend this spec. (An earlier version named specific
 * probe DTOs and had to be rewritten the moment the probe was deleted.)
 * `docs:check` keeps the committed files in sync with the code.
 */
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'];

interface Operation {
  operationId: string;
  responses: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function loadOperations(): Operation[] {
  const document: unknown = load(
    readFileSync(join(process.cwd(), 'docs', 'openapi.yaml'), 'utf8'),
  );
  if (!isRecord(document) || !isRecord(document.paths)) return [];

  const operations: Operation[] = [];
  for (const pathItem of Object.values(document.paths)) {
    if (!isRecord(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (
        isRecord(operation) &&
        typeof operation.operationId === 'string' &&
        isRecord(operation.responses)
      ) {
        operations.push({ operationId: operation.operationId, responses: operation.responses });
      }
    }
  }
  return operations;
}

/** A schema that says nothing: no `$ref`, no `type`, no properties, no composition. */
function isEmptySchema(schema: unknown): boolean {
  if (!isRecord(schema)) return true;
  return !['$ref', 'type', 'properties', 'allOf', 'oneOf', 'anyOf', 'enum'].some(
    (key) => key in schema,
  );
}

describe('generated OpenAPI contract', () => {
  const operations = loadOperations();

  it('found operations to check', () => {
    expect(operations.length).toBeGreaterThan(0);
  });

  it('every 2xx response with a body declares a real schema', () => {
    for (const { operationId, responses } of operations) {
      for (const [status, response] of Object.entries(responses)) {
        if (!status.startsWith('2') || status === '204' || !isRecord(response)) continue;

        const content = response.content;
        expect(
          isRecord(content),
          `${operationId} ${status} declares no response body — add @ApiOkResponse({ type: Dto })`,
        ).toBe(true);
        if (!isRecord(content)) continue;

        for (const [mediaType, media] of Object.entries(content)) {
          const schema = isRecord(media) ? media.schema : undefined;
          expect(
            isEmptySchema(schema),
            `${operationId} ${status} ${mediaType} has an empty schema — it would generate as \`unknown\``,
          ).toBe(false);
        }
      }
    }
  });

  it('the generated client types contain no unknown/never response bodies', () => {
    const generated = readFileSync(join(process.cwd(), 'docs', 'openapi.d.ts'), 'utf8');

    expect(generated).not.toMatch(/"application\/json":\s*(unknown|Record<string, never>|never)\b/);
  });
});
