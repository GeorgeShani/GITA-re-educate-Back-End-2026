import { z } from 'zod';
import { AuditEntryDetailDto, AuditEntryDto, AuditPageDto } from '#/audit/dto/audit-entry.dto.js';
import { AuditQueryDto } from '#/audit/dto/audit-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { AUDIT_ACTIONS } from '#/core/audit/audit-actions.js';
import { defineTool, validated, type Tool } from '../tool.js';

export const AUDIT_TOOLS: readonly Tool[] = [
  defineTool(
    {
      name: 'list_audit_log',
      title: 'List the audit log',
      description:
        'What people (and API keys, and agents) did in the company, newest first. Entries made through MCP carry ' +
        '`via: "mcp"` in their detail. Admin only. Returns `data` and `meta.nextCursor`.',
      scope: 'audit:read',
      roles: ['admin'],
      write: false,
      needsPlan: false,
    },
    {
      cursor: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      action: z.enum(AUDIT_ACTIONS).optional(),
      actorUserId: z.uuid().optional().describe('Only what this person did.'),
      targetType: z.string().max(50).optional().describe('The kind of thing acted on, e.g. `file`.'),
      from: z.iso.datetime().optional().describe('ISO 8601; at or after.'),
      to: z.iso.datetime().optional().describe('ISO 8601; before.'),
    },
    async (input, s) => {
      const page = await s.audit.list(await validated(AuditQueryDto, input));
      return toDto(AuditPageDto, mapPageData(page, AuditEntryDto.from));
    },
  ),

  defineTool(
    {
      name: 'get_audit_entry',
      title: 'Get an audit entry',
      description: 'One audit entry with its full detail (what changed, which key acted, whether via MCP). Admin only.',
      scope: 'audit:read',
      roles: ['admin'],
      write: false,
      needsPlan: false,
    },
    { id: z.uuid().describe('The entry id, from `list_audit_log`.') },
    async ({ id }, s) => AuditEntryDetailDto.from(await s.audit.get(id)),
  ),
];
