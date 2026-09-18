import { INestApplication } from '@nestjs/common';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { loadOpenApiDocument } from './yaml-loader';

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Confirms the merged YAML actually has the fields OpenAPIObject requires
 * (openapi, info.title, info.version, paths) before handing it to
 * SwaggerModule — narrows PlainObject to OpenAPIObject through real checks
 * instead of asserting the shape with `as`.
 */
function isOpenApiDocument(document: unknown): document is OpenAPIObject {
  if (!isPlainObject(document)) {
    return false;
  }

  if (typeof document.openapi !== 'string') {
    return false;
  }

  if (!isPlainObject(document.paths)) {
    return false;
  }

  const info = document.info;
  return (
    isPlainObject(info) &&
    typeof info.title === 'string' &&
    typeof info.version === 'string'
  );
}

/**
 * Serves a hand-written OpenAPI spec at /docs instead of generating one
 * from `@Api*` decorators sprinkled across the controllers. The spec
 * itself lives as plain YAML under ./docs, one file per resource, merged
 * together by loadOpenApiDocument().
 */
export function setupSwagger(app: INestApplication, path = 'docs'): void {
  const document = loadOpenApiDocument();

  if (!isOpenApiDocument(document)) {
    throw new Error(
      'src/swagger/docs/*.yaml did not merge into a valid OpenAPI document ' +
        '(missing openapi / info.title / info.version / paths) — check _root.yaml.',
    );
  }

  SwaggerModule.setup(path, app, document, {
    jsonDocumentUrl: `${path}/json`,
    yamlDocumentUrl: `${path}/yaml`,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
