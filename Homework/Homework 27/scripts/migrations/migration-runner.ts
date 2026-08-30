import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../../src/app.module';

type Migration = (connection: Connection) => Promise<void>;

/**
 * Boots a headless Nest context (reusing the app's config and Mongo
 * connection), runs the given migration once, then tears everything down.
 * Migrations are expected to be idempotent so they can be re-run safely.
 */
export async function runMigration(
  name: string,
  migration: Migration,
): Promise<void> {
  const logger = new Logger('Migration');
  const context: INestApplicationContext =
    await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });

  const connection = context.get<Connection>(getConnectionToken());

  try {
    logger.log(`Running "${name}"...`);
    await migration(connection);
    logger.log(`"${name}" completed successfully.`);
  } catch (error) {
    logger.error(`"${name}" failed.`, error as Error);
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}
