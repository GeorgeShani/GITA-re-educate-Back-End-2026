import type { AiProvider } from '#/core/ai/ai-provider.js';
import type { Narrative, NarrativeInput } from '#/core/ai/narrative.js';
import type { QueryPlan, QueryPlanInput } from '#/core/ai/query-spec.js';

/**
 * Stands in for Gemini. By default it writes a fixed narrative; a spec scripts a
 * different outcome with `next(...)` — a narrative, `null` (the provider produced
 * nothing usable) — and reads what it was shown from `calls`, which is how a spec
 * proves only aggregates ever reach a model.
 */
export class FakeAiProvider implements AiProvider {
  readonly name = 'fake';
  model: string | null = 'fake-model';
  readonly calls: NarrativeInput[] = [];
  readonly planCalls: QueryPlanInput[] = [];
  private script: Array<Narrative | null> = [];
  private plans: Array<QueryPlan | null> = [];

  static readonly DEFAULT: Narrative = {
    summary: 'The data looks mostly clean.',
    recommendations: ['Fill the empty cells.', 'Remove duplicate rows.'],
  };

  async generateNarrative(input: NarrativeInput): Promise<Narrative | null> {
    this.calls.push(input);
    return this.script.length > 0 ? (this.script.shift() ?? null) : FakeAiProvider.DEFAULT;
  }

  async planQuery(input: QueryPlanInput): Promise<QueryPlan | null> {
    this.planCalls.push(input);
    return this.plans.length > 0 ? (this.plans.shift() ?? null) : null;
  }

  /** The next `planQuery` answers with `plan` (`null`: nothing usable). Without one it answers `null`. */
  nextPlan(plan: QueryPlan | null): void {
    this.plans.push(plan);
  }

  /** The next call answers with `outcome` (then it reverts to the default). */
  next(outcome: Narrative | null): void {
    this.script.push(outcome);
  }

  reset(): void {
    this.calls.length = 0;
    this.planCalls.length = 0;
    this.script = [];
    this.plans = [];
    this.model = 'fake-model';
  }
}
