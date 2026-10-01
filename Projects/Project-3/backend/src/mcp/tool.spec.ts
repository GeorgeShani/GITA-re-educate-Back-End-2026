import 'reflect-metadata';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AuthenticatedUser } from '#/common/auth/authenticated-user.interface.js';
import { API_SCOPES, type ApiScope } from '#/common/auth/require-scopes.decorator.js';
import { DEMO_READ_ONLY_MESSAGE } from '#/demo/demo-read-only.guard.js';
import { ALL_TOOLS } from './mcp-server.factory.js';
import { McpServices } from './mcp-services.js';
import { type ToolMeta, ToolCaller, defineTool, refusalFor } from './tool.js';

function key(role: 'admin' | 'employee', scopes: readonly ApiScope[], isDemo = false): ToolCaller {
  const user: AuthenticatedUser = { userId: 'u', companyId: 'c', role, authMethod: 'api_key', isDemo, scopes: [...scopes] };
  return ToolCaller.of(user);
}

function session(role: 'admin' | 'employee', isDemo = false): ToolCaller {
  return ToolCaller.of({ userId: 'u', companyId: 'c', role, authMethod: 'jwt', isDemo });
}

const read: ToolMeta = { name: 't', title: 't', description: 'd', scope: 'files:read', roles: ['admin', 'employee'], write: false, needsPlan: false };
const write: ToolMeta = { ...read, scope: 'files:write', write: true };
const adminOnly: ToolMeta = { ...read, scope: 'audit:read', roles: ['admin'] };

describe('refusalFor', () => {
  it('lets a key use a tool only with the scope the matching REST route needs', () => {
    expect(refusalFor(read, key('employee', ['mcp', 'files:read']))).toBeNull();
    expect(refusalFor(read, key('employee', ['mcp']))).toContain('files:read');
    expect(refusalFor(write, key('employee', ['mcp', 'files:read']))).toContain('files:write');
  });

  it('keeps an employee out of an admin tool even if the key somehow holds its scope', () => {
    expect(refusalFor(adminOnly, key('employee', ['audit:read']))).toMatch(/role/);
    expect(refusalFor(adminOnly, key('admin', ['audit:read']))).toBeNull();
  });

  it('gives a session every scope (scopes are a key concept) but still narrows by role', () => {
    expect(refusalFor(write, session('employee'))).toBeNull();
    expect(refusalFor(adminOnly, session('employee'))).toMatch(/role/);
    expect(refusalFor(adminOnly, session('admin'))).toBeNull();
  });

  it('refuses a write to the read-only demo company, with its reason, and still allows reads', () => {
    expect(refusalFor(write, key('admin', API_SCOPES, true))).toBe(DEMO_READ_ONLY_MESSAGE);
    expect(refusalFor(write, session('admin', true))).toBe(DEMO_READ_ONLY_MESSAGE);
    expect(refusalFor(read, key('admin', API_SCOPES, true))).toBeNull();
  });
});

describe('the tool catalogue', () => {
  it('has unique names, and every tool names a real scope', () => {
    const names = ALL_TOOLS.map((tool) => tool.meta.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of ALL_TOOLS) expect(API_SCOPES).toContain(tool.meta.scope);
  });

  it('puts every write behind a write scope or an owner-only scope, never a read scope', () => {
    const writes = ALL_TOOLS.filter((tool) => tool.meta.write);
    expect(writes.length).toBeGreaterThan(0);
    for (const tool of writes) {
      // `mark_notifications_read` is the one write on a read-named scope: it only touches the caller's own inbox.
      if (tool.meta.name === 'mark_notifications_read') continue;
      expect(['files:write', 'rules:write']).toContain(tool.meta.scope);
    }
  });

  it('keeps the scopes that open admin data on admin-only tools', () => {
    for (const tool of ALL_TOOLS) {
      if (['billing:read', 'audit:read', 'rules:write'].includes(tool.meta.scope)) {
        expect(tool.meta.roles).toEqual(['admin']);
      }
    }
  });
});

/** A server that only remembers the handler it was given, so a spec can call it directly. */
class CapturingServer {
  handler: ((args: unknown) => Promise<unknown>) | undefined;
  registerTool(_name: string, _config: unknown, handler: (args: unknown) => Promise<unknown>): void {
    this.handler = handler;
  }
}

describe('a registered tool’s own check', () => {
  // The services are never reached when the check refuses, so a bare instance is enough.
  const services: McpServices = Object.create(McpServices.prototype);

  async function invoke(meta: ToolMeta, caller: ToolCaller) {
    const run = vi.fn(async () => ({ ok: true }));
    const server = new CapturingServer();
    defineTool(meta, { id: z.string().optional() }, run).register(server as unknown as McpServer, caller, services);
    const result = await server.handler?.({});
    return { result, run };
  }

  it('refuses a caller without the scope even when asked directly, and never runs the tool', async () => {
    const { result, run } = await invoke(write, key('employee', ['mcp', 'files:read']));
    expect(result).toMatchObject({ isError: true });
    expect(JSON.stringify(result)).toContain('files:write');
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses a demo user’s write directly, with the demo reason', async () => {
    const { result, run } = await invoke(write, session('admin', true));
    expect(JSON.stringify(result)).toContain(DEMO_READ_ONLY_MESSAGE);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses a role the tool is not for', async () => {
    const { result, run } = await invoke(adminOnly, session('employee'));
    expect(result).toMatchObject({ isError: true });
    expect(run).not.toHaveBeenCalled();
  });
});
