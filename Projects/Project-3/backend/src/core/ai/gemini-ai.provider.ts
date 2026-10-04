import { GoogleGenAI } from '@google/genai';
import type { AiProvider } from './ai-provider.js';
import { type QueryPlan, type QueryPlanInput, buildQueryPlanPrompt, parseQueryPlan } from './query-spec.js';
import { type Narrative, type NarrativeInput, buildNarrativePrompt, parseNarrative } from './narrative.js';

/** The slice of the SDK this uses, so a test can hand in a stub instead of a network client. */
export interface GeminiClient {
  models: {
    generateContent(request: {
      model: string;
      contents: string;
      config: {
        responseMimeType: string;
        temperature: number;
        maxOutputTokens: number;
        httpOptions: { timeout: number };
      };
    }): Promise<{ text?: string }>;
  };
}

/** A report is not worth waiting on: past this the narrative is simply skipped. */
const TIMEOUT_MS = 20_000;

/** A person is waiting on a question, so it gets less time than a report does. */
const PLAN_TIMEOUT_MS = 15_000;

export interface GeminiLogger {
  warn(context: object, message: string): void;
}

/**
 * Gemini via `@google/genai`. Asked for JSON, then `safeParse`d with Zod: a malformed
 * or off-shape answer, an API error and a timeout are all `null` plus a logged warning —
 * the report is never failed by the narrative.
 */
export class GeminiAiProvider implements AiProvider {
  readonly name = 'gemini';

  constructor(
    readonly model: string,
    private readonly logger: GeminiLogger,
    private readonly client: GeminiClient,
  ) {}

  static create(apiKey: string, model: string, logger: GeminiLogger): GeminiAiProvider {
    return new GeminiAiProvider(model, logger, new GoogleGenAI({ apiKey }));
  }

  async generateNarrative(input: NarrativeInput): Promise<Narrative | null> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildNarrativePrompt(input),
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 1_024,
          httpOptions: { timeout: TIMEOUT_MS },
        },
      });

      const narrative = parseNarrative(response.text);
      if (!narrative) this.logger.warn({ model: this.model }, 'Gemini returned an unusable narrative; skipping it');
      return narrative;
    } catch (error) {
      this.logger.warn({ err: error, model: this.model }, 'Gemini request failed; skipping the narrative');
      return null;
    }
  }

  async planQuery(input: QueryPlanInput): Promise<QueryPlan | null> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildQueryPlanPrompt(input),
        config: {
          responseMimeType: 'application/json',
          temperature: 0,
          maxOutputTokens: 1_024,
          httpOptions: { timeout: PLAN_TIMEOUT_MS },
        },
      });
      const plan = parseQueryPlan(response.text);
      if (!plan) this.logger.warn({ model: this.model }, 'Gemini returned an unusable query plan; skipping it');
      return plan;
    } catch (error) {
      this.logger.warn({ err: error, model: this.model }, 'Gemini request failed; no query plan');
      return null;
    }
  }
}
