import type { FunctionDeclaration } from '@google/genai';

// Resolved from the authenticated request (CLS/JwtAuthGuard), never from
// model input — SCOPE.md Phase 8's security invariant: the model must
// have no way to address another user's cart or session.
export interface AssistantToolContext {
  userId: string;
  correlationId: string;
}

export interface AssistantTool {
  /** Source: https://github.com/googleapis/js-genai README — the FunctionDeclaration shape @google/genai expects under config.tools[].functionDeclarations. */
  readonly declaration: FunctionDeclaration;
  /**
   * Mutating tools never execute inline — AssistantService intercepts
   * them and returns a pending-confirmation turn instead, only calling
   * execute() once the user approves (SCOPE.md Phase 8's hand-rolled
   * confirmation gate, since Gemini has no per-turn approval hook the
   * way the Claude SDK's toolRunner does).
   */
  readonly mutating: boolean;
  execute(
    args: Record<string, unknown>,
    ctx: AssistantToolContext,
  ): Promise<unknown>;
}
