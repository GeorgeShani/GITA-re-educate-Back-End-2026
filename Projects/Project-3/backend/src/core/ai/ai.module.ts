import { Global, Module } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AI_PROVIDER, type AiProvider } from './ai-provider.js';
import { GeminiAiProvider } from './gemini-ai.provider.js';
import { NullAiProvider } from './null-ai.provider.js';

/**
 * `AI_PROVIDER=gemini` with a key binds Gemini; everything else — `off` (the default),
 * or `gemini` without `GEMINI_API_KEY` — binds the null provider, so the deterministic
 * metrics always render and a missing key is a warning, not a failed boot.
 */
export function buildAiProvider(config: AppConfig, logger: PinoLogger): AiProvider {
  if (config.AI_PROVIDER !== 'gemini') return new NullAiProvider();

  if (!config.GEMINI_API_KEY) {
    logger.warn('AI_PROVIDER=gemini but GEMINI_API_KEY is not set; reports will have no narrative');
    return new NullAiProvider();
  }
  return GeminiAiProvider.create(config.GEMINI_API_KEY, config.GEMINI_MODEL, logger);
}

@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [APP_CONFIG, PinoLogger],
      useFactory: buildAiProvider,
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
