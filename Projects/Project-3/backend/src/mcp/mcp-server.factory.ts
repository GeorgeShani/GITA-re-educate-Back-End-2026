import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable } from '@nestjs/common';
import { McpServices } from './mcp-services.js';
import { type Tool, ToolCaller, refusalFor } from './tool.js';
import { AUDIT_TOOLS } from './tools/audit.tools.js';
import { BILLING_TOOLS } from './tools/billing.tools.js';
import { FILES_TOOLS } from './tools/files.tools.js';
import { NOTIFICATION_TOOLS } from './tools/notifications.tools.js';
import { QUALITY_RULE_TOOLS } from './tools/quality-rules.tools.js';

export const ALL_TOOLS: readonly Tool[] = [
  ...FILES_TOOLS,
  ...QUALITY_RULE_TOOLS,
  ...BILLING_TOOLS,
  ...AUDIT_TOOLS,
  ...NOTIFICATION_TOOLS,
];

const INSTRUCTIONS = `You are connected to Gridline, a spreadsheet data-quality service, as one person of one company.

- A file is a CSV/XLS/XLSX spreadsheet. Uploading another version of it adds a version to the same dataset; \`list_files\` shows each dataset once, as its latest version.
- Every file gets a data-quality report: statistics about its columns (never its cell values), the company's rules checked against it, and a score. It is built in the background, so right after an upload \`get_quality_report\` may say it is not ready: wait a moment and ask again.
- "Not found" can mean a file does not exist OR this person may not see it. That is deliberate; do not try to work around it.
- The plan limits files per period. A refusal with 402 names the limit; check \`get_plan_and_quota\` before a big batch.
- If an upload call times out, repeat it with the same \`idempotencyKey\` so it cannot upload twice.
- You can only use the tools you were given; they follow this person's role and their API key's scopes.`;

/** Builds the server for ONE request: the tools this caller may use, and no others. Nothing is shared between requests. */
@Injectable()
export class McpServerFactory {
  constructor(private readonly services: McpServices) {}

  create(caller: ToolCaller): McpServer {
    const server = new McpServer({ name: 'gridline', version: '1.0.0' }, { instructions: INSTRUCTIONS });
    for (const tool of ALL_TOOLS) {
      if (refusalFor(tool.meta, caller) === null) tool.register(server, caller, this.services);
    }
    return server;
  }
}
