import type { ApolloServerPlugin } from '@apollo/server';
import {
  type ASTNode,
  type DocumentNode,
  type FragmentDefinitionNode,
  GraphQLError,
  type GraphQLSchema,
  Kind,
  type SelectionSetNode,
  type ValidationContext,
  type ValidationRule,
} from 'graphql';
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from 'graphql-query-complexity';

/** Deepest selection a query may nest. The real queries here are 4 deep; introspection walks far deeper. */
export const MAX_QUERY_DEPTH = 6;
/** Cost ceiling per query, priced by the field `complexity` settings in `analytics.types.ts` / the resolver. */
export const MAX_QUERY_COMPLEXITY = 1000;

/** How deep `selectionSet` goes, following fragments (each visited once, so a cycle cannot loop). */
function depthOf(
  selectionSet: SelectionSetNode | undefined,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
  seen: ReadonlySet<string>,
): number {
  if (!selectionSet) return 0;
  let deepest = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      deepest = Math.max(deepest, 1 + depthOf(selection.selectionSet, fragments, seen));
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      deepest = Math.max(deepest, depthOf(selection.selectionSet, fragments, seen));
    } else if (!seen.has(selection.name.value)) {
      const fragment = fragments.get(selection.name.value);
      const next = new Set(seen).add(selection.name.value);
      deepest = Math.max(deepest, depthOf(fragment?.selectionSet, fragments, next));
    }
  }
  return deepest;
}

/**
 * Rejects a query nested deeper than `maximum`, naming both numbers, before anything runs.
 * Written here rather than pulled in: it is a screenful, and a dependency for it would be
 * one more thing to keep compatible with graphql 16.
 */
export function depthLimitRule(maximum: number): ValidationRule {
  return (context: ValidationContext) => ({
    OperationDefinition(node: ASTNode) {
      if (node.kind !== Kind.OPERATION_DEFINITION) return;
      const fragments = new Map<string, FragmentDefinitionNode>();
      for (const definition of context.getDocument().definitions) {
        if (definition.kind === Kind.FRAGMENT_DEFINITION) fragments.set(definition.name.value, definition);
      }
      const depth = depthOf(node.selectionSet, fragments, new Set());
      if (depth > maximum) {
        context.reportError(
          new GraphQLError(
            `This query is nested ${depth} levels deep; the most allowed is ${maximum}. Ask for less at once.`,
            { nodes: [node], extensions: { code: 'QUERY_TOO_DEEP', depth, maximum } },
          ),
        );
      }
    },
  });
}

const ESTIMATORS = [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: 1 })];

/**
 * The priced cost of a query WITH the variables it was sent with. A list's cost is `first × what it selects`, and `first` is
 * very often a variable (`files(first: $first)`), so pricing without the variables cannot work: graphql-query-complexity's
 * validation rule never sees a request's variables, and refused every query that declared a required one ("Variable
 * `$first` of required type `Int!` was not provided"). That is why the check runs as a plugin, where the request is known.
 */
export function complexityOf(
  schema: GraphQLSchema,
  document: DocumentNode,
  variables: Record<string, unknown> | undefined,
  operationName: string | null | undefined,
): number {
  return getComplexity({
    schema,
    query: document,
    variables: variables ?? {},
    ...(operationName ? { operationName } : {}),
    estimators: ESTIMATORS,
  });
}

/** Rejects a query whose priced cost exceeds `maximum`, with the actual cost in the message, before any resolver runs. */
export function complexityLimitPlugin(maximum: number): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation({ schema, document, request, operationName }) {
          let cost: number;
          try {
            cost = complexityOf(schema, document, request.variables, operationName);
          } catch (error) {
            // A variable the query needs but the request did not send: the same 400 GraphQL itself would give.
            throw error instanceof GraphQLError
              ? new GraphQLError(error.message, { extensions: { code: 'BAD_USER_INPUT', http: { status: 400 } } })
              : error;
          }
          if (cost > maximum) {
            throw new GraphQLError(
              `This query costs ${cost}; the most allowed is ${maximum}. Ask for fewer fields or lists at once, or split it into several queries.`,
              { extensions: { code: 'QUERY_TOO_COMPLEX', cost, maximum, http: { status: 400 } } },
            );
          }
        },
      };
    },
  };
}
