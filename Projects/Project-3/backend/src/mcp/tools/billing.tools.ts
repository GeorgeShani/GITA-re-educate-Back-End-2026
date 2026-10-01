import { z } from 'zod';
import { InvoiceDto, InvoicePageDto } from '#/billing/dto/invoice.dto.js';
import { StatementDto } from '#/billing/dto/statement.dto.js';
import { parseLineItems } from '#/billing/line-item.schema.js';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { defineTool, validated, type Tool } from '../tool.js';

export const BILLING_TOOLS: readonly Tool[] = [
  defineTool(
    {
      name: 'get_current_bill',
      title: 'Get the running bill',
      description:
        'What the company owes for the current period so far: the plan, seats, files and any overage, itemised in ' +
        'cents. Admin only. An estimate until the period closes.',
      scope: 'billing:read',
      roles: ['admin'],
      write: false,
      needsPlan: true,
    },
    {},
    async (_input, s) => {
      const statement = await s.billing.currentStatement();
      return toDto(StatementDto, { ...statement, lineItems: parseLineItems(statement.lineItems) });
    },
  ),

  defineTool(
    {
      name: 'list_invoices',
      title: 'List invoices',
      description: 'Past invoices, newest first, with totals in cents and their status. Admin only.',
      scope: 'billing:read',
      roles: ['admin'],
      write: false,
      needsPlan: true,
    },
    {
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (input, s) => {
      const invoices = await s.billing.listInvoices(await validated(OffsetQueryDto, input));
      return toDto(InvoicePageDto, mapPageData(invoices, InvoiceDto.from));
    },
  ),

  defineTool(
    {
      name: 'get_invoice',
      title: 'Get an invoice',
      description: 'One invoice with its line items. Admin only.',
      scope: 'billing:read',
      roles: ['admin'],
      write: false,
      needsPlan: true,
    },
    { id: z.uuid().describe('The invoice id, from `list_invoices`.') },
    async ({ id }, s) => InvoiceDto.from(await s.billing.getInvoice(id)),
  ),
];
