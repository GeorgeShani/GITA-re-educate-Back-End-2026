import './skip-db-connect.js';
import '#/load-env.js';
import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '#/app.module.js';
import { mergeProse } from './prose.js';
import { buildOpenApiDocument } from './swagger-document.js';

export interface MergedDocument {
  document: OpenAPIObject;
  missingProse: string[];
}

/**
 * Shared by `generate.ts` and `check.ts`: boot the real app (no live database
 * needed — see `skip-db-connect.ts`), extract the OpenAPI document, merge
 * prose, and hand back both the document and the list of anything left
 * undocumented.
 */
export async function buildMergedDocument(): Promise<MergedDocument> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  await app.close();

  const missingProse = mergeProse(document);
  return { document, missingProse };
}
