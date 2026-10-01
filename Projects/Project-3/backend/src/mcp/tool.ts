import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedUser } from '#/common/auth/authenticated-user.interface.js';
import type { ApiScope } from '#/common/auth/require-scopes.decorator.js';
import { extractMessage } from '#/core/filters/all-exceptions.filter.js';
import { VALIDATION_PIPE_OPTIONS } from '#/core/validation-pipe-options.js';
import { DEMO_READ_ONLY_MESSAGE } from '#/demo/demo-read-only.guard.js';
import type { UserRole } from '#/database/entities/user.entity.js';
import type { McpServices } from './mcp-services.js';

/** Who is calling, as `AuthGuard` resolved it for THIS request (a key's creator's live role, the key's narrowed scopes). */
export class ToolCaller {
  private constructor(
    readonly companyId: string,
    readonly role: UserRole,
    readonly isDemo: boolean,
    /** `null` for a session: scopes are an API-key concept and a session holds them all. */
    private readonly scopes: ReadonlySet<ApiScope> | null,
  ) {}

  static of(user: AuthenticatedUser): ToolCaller {
    const scopes = user.authMethod === 'api_key' ? new Set(user.scopes ?? []) : null;
    return new ToolCaller(user.companyId, user.role, user.isDemo, scopes);
  }

  holds(scope: ApiScope): boolean {
    return this.scopes === null || this.scopes.has(scope);
  }
}

export interface ToolMeta {
  name: string;
  title: string;
  /** Read by the model: say what it returns and when to use it, in plain words. */
  description: string;
  /** The key scope a REST route for the same thing declares. */
  scope: ApiScope;
  roles: readonly UserRole[];
  /** A write is hidden from, and refused to, the demo company (whose every POST is refused on REST). */
  write: boolean;
  /** REST's `@RequiresSubscription()`: the company must have chosen a plan (402 otherwise). */
  needsPlan: boolean;
  destructive?: boolean;
  idempotent?: boolean;
}

export interface Tool {
  readonly meta: ToolMeta;
  register(server: McpServer, caller: ToolCaller, services: McpServices): void;
}

/** Why this caller may not use the tool, or `null` when they may. The same answer filters the list and guards the call. */
export function refusalFor(meta: ToolMeta, caller: ToolCaller): string | null {
  if (!meta.roles.includes(caller.role)) return 'Your role may not use this tool.';
  if (!caller.holds(meta.scope)) return `This API key lacks the required scope: ${meta.scope}.`;
  if (meta.write && caller.isDemo) return DEMO_READ_ONLY_MESSAGE;
  return null;
}

export function defineTool<Shape extends z.ZodRawShape>(
  meta: ToolMeta,
  input: Shape,
  run: (input: z.infer<z.ZodObject<Shape>>, services: McpServices, caller: ToolCaller) => Promise<unknown>,
): Tool {
  const schema = z.object(input);
  // Not generic past this point: the SDK's callback type is conditional on the shape and cannot be resolved for a type parameter.
  const shape: z.ZodRawShape = input;
  return {
    meta,
    register(server, caller, services) {
      server.registerTool(
        meta.name,
        {
          title: meta.title,
          description: meta.description,
          inputSchema: shape,
          annotations: {
            readOnlyHint: !meta.write,
            destructiveHint: meta.write ? (meta.destructive ?? false) : false,
            idempotentHint: meta.idempotent ?? !meta.write,
            openWorldHint: false,
          },
        },
        async (args: unknown): Promise<ToolResult> => {
          // The list already hides what this caller may not use; asking again here is what keeps a direct
          // `tools/call` for a hidden tool from working.
          const refusal = refusalFor(meta, caller);
          if (refusal) return failure(`${HttpStatus.FORBIDDEN} ${refusal}`);
          try {
            if (meta.needsPlan && !(await services.subscriptions.exists(caller.companyId))) {
              throw new HttpException(
                'No plan selected yet. Choose one with POST /subscriptions/me to use this feature.',
                HttpStatus.PAYMENT_REQUIRED,
              );
            }
            return success(await run(schema.parse(args), services, caller));
          } catch (error) {
            return failureOf(error, services);
          }
        },
      );
    },
  };
}

/** Validates tool input against the SAME class-validator DTO the REST route uses, under the same global rules. */
export function validated<T extends object>(dto: new () => T, input: object): Promise<T> {
  const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);
  return pipe.transform(input, { type: 'body', metatype: dto });
}

interface ToolResult {
  [key: string]: unknown; // the SDK's result type is open
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

function success(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function failure(text: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text }] };
}

/**
 * A service's own refusal (404, 402, 409, 422…) is shown to the agent as it is: the message is what lets it recover.
 * Anything else could carry a database or library detail, so it is replaced and logged with the request's id.
 */
function failureOf(error: unknown, services: McpServices): ToolResult {
  if (error instanceof HttpException) {
    const message = extractMessage(error.getResponse());
    const status = error.getStatus();
    services.logger.warn({ statusCode: status, message }, 'MCP tool rejected');
    return failure(`${status} ${Array.isArray(message) ? message.join('; ') : message}`);
  }
  services.logger.error({ err: error }, 'MCP tool failed');
  const id = services.context.correlationId;
  return failure(`500 Something went wrong on our side.${id ? ` Quote this id to support: ${id}` : ''}`);
}
