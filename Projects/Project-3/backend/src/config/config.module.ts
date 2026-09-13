import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import type { AppConfig } from './env.schema.js';
import { APP_CONFIG, loadConfig } from './load-config.js';

/**
 * Global config. `@nestjs/config` is used only for its `.env` loading and the
 * boot-time `validate` hook; nothing in the app injects `ConfigService`.
 *
 * Everything reads the frozen, fully typed `AppConfig` via `APP_CONFIG`, so a
 * mistyped key is a compile error rather than a runtime `undefined` — the single
 * biggest ergonomic gap in Project-2, where every read was
 * `configService.get<string>('SOME_KEY')`.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Returning the parsed object also normalises process.env for anything
      // that reads it directly before the injector exists.
      validate: (raw: Record<string, unknown>) =>
        loadConfig(raw as NodeJS.ProcessEnv),
    }),
  ],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
