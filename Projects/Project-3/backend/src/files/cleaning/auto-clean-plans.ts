import type { Plan } from '#/subscriptions/plan-catalog.js';

/** The plans that may have every new version of a dataset cleaned automatically. */
export const AUTO_CLEAN_PLANS: readonly Plan[] = ['basic', 'premium'];
