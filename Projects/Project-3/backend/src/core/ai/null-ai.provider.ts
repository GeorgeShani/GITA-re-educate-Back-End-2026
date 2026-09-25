import type { AiProvider } from './ai-provider.js';

/** `AI_PROVIDER=off`: metrics only, no narrative, no network. */
export class NullAiProvider implements AiProvider {
  readonly name = 'off';
  readonly model = null;

  async generateNarrative(): Promise<null> {
    return null;
  }
}
