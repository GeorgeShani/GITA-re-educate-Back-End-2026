import { PLAN_CATALOG, type Plan } from '#/subscriptions/plan-catalog.js';

const LABEL: Record<Plan, string> = { free: 'Free', basic: 'Basic', premium: 'Premium' };

/**
 * Why one more employee cannot be added — or `null` when there is room.
 * `held` is employees holding a seat: `invited` AND `active`. An invitation
 * holds a seat from the moment it is sent (D4), otherwise a company could queue
 * fifty invites on a ten-seat plan; disabled employees have freed theirs.
 */
export function seatCapProblem(plan: Plan, held: number): string | null {
  const max = PLAN_CATALOG[plan].maxEmployees;
  if (max === null || held < max) return null;

  return max === 0
    ? `The ${LABEL[plan]} plan has no employee seats. Upgrade to invite employees.`
    : `The ${LABEL[plan]} plan allows ${max} employees and all ${max} seats are taken ` +
        '(an invitation holds a seat). Remove someone or upgrade.';
}
