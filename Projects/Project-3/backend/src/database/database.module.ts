import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import type { AppConfig } from '../config/env.schema.js';
import { APP_CONFIG } from '../config/load-config.js';
import { buildDataSourceOptions } from './data-source-options.js';
import { ENTITIES } from './entities.js';
import { TenantScope } from './tenant-scope.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): DataSourceOptions =>
        // false: the app always talks to Neon's pooled endpoint. Only the
        // standalone migration CLI uses the direct one.
        buildDataSourceOptions(config, { direct: false }),

      // Rendering API docs (Phase 4's `docs:generate`) shouldn't require a
      // live database. When DB_SKIP_CONNECT is set, the DataSource is built
      // but `.initialize()` is never called — NestFactory.create() still
      // boots cleanly, because nothing in this app issues a query at
      // bootstrap.
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('TypeORM DataSourceOptions were not provided');
        }

        const dataSource = new DataSource(options);
        if (process.env.DB_SKIP_CONNECT === '1') {
          return dataSource;
        }

        return dataSource.initialize();
      },
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  providers: [TenantScope],
  exports: [TypeOrmModule, TenantScope],
})
export class DatabaseModule {}
