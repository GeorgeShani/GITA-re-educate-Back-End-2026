import { buildSchema, parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';
import { complexityLimitRule, depthLimitRule } from './query-limits.js';

const schema = buildSchema(`
  type Leaf { name: String }
  type Node { name: String, child: Node, leaves: [Leaf!]! }
  type Query { node: Node }
`);

const check = (query: string, maximum: number) =>
  validate(schema, parse(query), [depthLimitRule(maximum)]).map((error) => error.message);

describe('depthLimitRule', () => {
  it('allows a query exactly at the limit and refuses one level past it, naming both numbers', () => {
    const atLimit = '{ node { child { child { name } } } }'; // 4
    expect(check(atLimit, 4)).toEqual([]);
    const errors = check(atLimit, 3);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('nested 4 levels deep');
    expect(errors[0]).toContain('the most allowed is 3');
  });

  it('counts through inline fragments and named fragments', () => {
    expect(check('{ node { ... on Node { child { name } } } }', 3)).toEqual([]);
    expect(check('{ node { ... on Node { child { name } } } }', 2)).toHaveLength(1);

    const named = 'query { node { ...A } } fragment A on Node { child { ...B } } fragment B on Node { child { name } }';
    expect(check(named, 4)).toEqual([]); // node > child > child > name
    expect(check(named, 3)).toHaveLength(1);
  });

  it('takes the deepest branch, not the widest', () => {
    expect(check('{ node { name name name leaves { name } } }', 3)).toEqual([]);
  });

  it('cannot be sent into a loop by a fragment cycle', () => {
    const cyclic = 'query { node { ...A } } fragment A on Node { child { ...A } }';
    expect(() => check(cyclic, 10)).not.toThrow();
  });

  it('judges every operation in a document', () => {
    const errors = check('query A { node { name } } query B { node { child { child { name } } } }', 3);
    expect(errors).toHaveLength(1);
  });
});

describe('complexityLimitRule', () => {
  const cost = (query: string, maximum: number) =>
    validate(schema, parse(query), [complexityLimitRule(maximum)]).map((error) => error.message);

  it('prices each field at 1 by default and refuses over the cap, with the actual cost', () => {
    expect(cost('{ node { name } }', 2)).toEqual([]);
    const errors = cost('{ node { name child { name } } }', 2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/costs 4; the most allowed is 2/);
  });
});
