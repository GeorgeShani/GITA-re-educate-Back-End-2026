import { describe, expect, it } from 'vitest';
import { seatCapProblem } from './seat-cap.js';

describe('seatCapProblem', () => {
  it('has room below the cap', () => {
    expect(seatCapProblem('basic', 0)).toBeNull();
    expect(seatCapProblem('basic', 9)).toBeNull();
  });

  it('is full at exactly the cap — the 11th person is refused, not the 10th', () => {
    expect(seatCapProblem('basic', 10)).toMatch(/allows 10 employees/);
    expect(seatCapProblem('basic', 11)).not.toBeNull();
  });

  it('Free has no employee seats at all, and says so', () => {
    expect(seatCapProblem('free', 0)).toBe('The Free plan has no employee seats. Upgrade to invite employees.');
  });

  it('Premium is never full', () => {
    expect(seatCapProblem('premium', 0)).toBeNull();
    expect(seatCapProblem('premium', 10_000)).toBeNull();
  });

  it('tells the admin an invitation holds a seat', () => {
    expect(seatCapProblem('basic', 10)).toMatch(/invitation holds a seat/);
  });
});
