import type { Narrative, NarrativeInput } from './narrative.js';

/**
 * Writes the plain-language half of a data-quality report. The seam exists so the
 * deterministic metrics never depend on an AI account: `AI_PROVIDER=off` (the default)
 * binds `NullAiProvider`, Gemini binds `GeminiAiProvider`, tests bind a fake.
 *
 * Contract: NEVER throws and NEVER blocks a report. A timeout, a refusal, malformed
 * output or a missing key all come back as `null`, and the report ships with its
 * metrics and no narrative.
 */
export interface AiProvider {
  readonly name: 'gemini' | 'off' | 'fake';
  /** The model that wrote the narrative, recorded on the report. `null` when there is none. */
  readonly model: string | null;
  generateNarrative(input: NarrativeInput): Promise<Narrative | null>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
