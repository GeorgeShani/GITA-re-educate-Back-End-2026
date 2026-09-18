import type { OpenAPIObject, PathItemObject } from '@nestjs/swagger';

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

/**
 * One OpenAPI document per tag, written alongside the full `openapi.yaml` —
 * for reviewable diffs, so a PR touching only `files/` doesn't show a diff
 * across the whole API surface. The full document stays the single source of
 * truth; these are a generated convenience, never hand-edited, same as it.
 */
export function splitByTag(document: OpenAPIObject): Map<string, OpenAPIObject> {
  const byTag = new Map<string, OpenAPIObject>();

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const tag = operation.tags?.[0] ?? 'untagged';
      const tagDocument = byTag.get(tag) ?? { ...document, paths: {} };
      const existingPathItem: PathItemObject = tagDocument.paths[path] ?? {};

      tagDocument.paths = {
        ...tagDocument.paths,
        [path]: { ...existingPathItem, [method]: operation },
      };
      byTag.set(tag, tagDocument);
    }
  }

  return byTag;
}
