import { buildSchema, parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';
import { complexityOf, depthLimitRule } from './query-limits.js';

const schema = buildSchema(`
  type Leaf { name: String }
  type Node { name: String, child: Node, leaves: [Leaf!]! }
  type Query { node: Node, echo(n: Int!): Node }
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

describe('complexityOf', () => {
  const price = (query: string, variables?: Record<string, unknown>) => complexityOf(schema, parse(query), variables, undefined);

  it('prices each field at 1 by default', () => {
    expect(price('{ node { name } }')).toBe(2);
    expect(price('{ node { name child { name } } }')).toBe(4);
  });

  it('prices a query that declares a REQUIRED variable, using the value it was sent', () => {
    // The validation rule this replaced refused any such query ("Variable $n of required type Int! was not provided").
    expect(price('query ($n: Int!) { echo(n: $n) { name } }', { n: 5 })).toBe(2);
  });

  it('answers with the missing variable, as GraphQL itself would, when the request left one out', () => {
    expect(() => price('query ($n: Int!) { echo(n: $n) { name } }', {})).toThrow(/\$n/);
  });
});
