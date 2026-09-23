import type { ZodType } from 'zod';
import type { BackgroundTaskType } from './background-task.entity.js';

/**
 * One handler per task type. The runner parses `payload` with `schema` before
 * calling `handle`, so a handler only ever sees a validated payload — the
 * `jsonb` column it came from is untyped by definition.
 */
export interface TaskHandler<TPayload = unknown> {
  readonly type: BackgroundTaskType;
  readonly schema: ZodType<TPayload>;
  handle(payload: TPayload): Promise<void>;
}

/**
 * The list of every registered handler. Nest has no multi-provider, so this
 * is assembled explicitly in `TaskHandlersModule`; a new handler is added
 * there, in one visible place.
 */
export const TASK_HANDLERS = Symbol('TASK_HANDLERS');
