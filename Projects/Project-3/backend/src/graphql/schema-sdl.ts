import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { lexicographicSortSchema, printSchema } from 'graphql';
import { AnalyticsResolver } from './analytics.resolver.js';

/** Where the committed schema lives, relative to the backend root (where npm scripts run). */
export const SCHEMA_FILE = 'src/graphql/schema.gql';

/**
 * The schema as SDL, sorted, built WITHOUT booting the app (no database, no config): just the
 * resolver classes' decorators. `GraphqlApiModule` sorts too (`sortSchema: true`), so this and the
 * running server print identically, which `graphql.integration.spec.ts` asserts.
 */
export async function buildSchemaSdl(): Promise<string> {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule, { logger: false });
  try {
    await app.init();
    const schema = await app.get(GraphQLSchemaFactory).create([AnalyticsResolver]);
    return `${printSchema(lexicographicSortSchema(schema))}\n`;
  } finally {
    await app.close();
  }
}
