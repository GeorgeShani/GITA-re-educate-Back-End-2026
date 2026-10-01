import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Controller, Delete, Get, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '#/common/auth/authenticated-user.interface.js';
import { CurrentUser } from '#/common/auth/current-user.decorator.js';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { DemoWritesCheckedByHandler } from '#/demo/demo-writes-checked.decorator.js';
import { McpServerFactory } from './mcp-server.factory.js';
import { ToolCaller } from './tool.js';

/**
 * The MCP endpoint: a new doorway to the same services, not a new policy. It rides the global guard chain like any
 * route (`AuthGuard` resolves the key and re-reads its creator, the plan throttler spends the company's budget,
 * `ScopesGuard` demands the `mcp` scope), then serves one JSON-RPC exchange in STATELESS mode: a fresh server per
 * request, no session to store, so any instance can answer any call.
 *
 * Not in the OpenAPI document (it is JSON-RPC, not REST): the README says how to connect.
 */
@ApiTags('mcp')
@ApiExcludeController()
@Roles('admin', 'employee')
@RequireScopes('mcp')
// The method is always POST, whatever the tool does, so the guard cannot tell a read from a write: each tool checks.
@DemoWritesCheckedByHandler()
@Controller('mcp')
export class McpController {
  constructor(
    private readonly factory: McpServerFactory,
    private readonly context: RequestContextService,
  ) {}

  @Post()
  async handle(
    @Req() request: Request,
    @Res() response: Response,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    this.context.setChannel('mcp');

    const server = this.factory.create(ToolCaller.of(user));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    response.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  }

  // Stateless: there is no stream to open and no session to end.
  @Get()
  openStream(@Res() response: Response): void {
    methodNotAllowed(response);
  }

  @Delete()
  endSession(@Res() response: Response): void {
    methodNotAllowed(response);
  }
}

function methodNotAllowed(response: Response): void {
  response
    .status(HttpStatus.METHOD_NOT_ALLOWED)
    .set('Allow', 'POST')
    .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed. Send MCP requests with POST.' }, id: null });
}
