import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AllowWhenSuspended } from '#/common/auth/allow-when-suspended.decorator.js';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { BillingIntentService } from '#/payments/billing-intent.service.js';
import { BillingService } from './billing.service.js';
import { InvoiceDto, InvoicePageDto } from './dto/invoice.dto.js';
import { StatementDto } from './dto/statement.dto.js';
import { PortalSessionDto } from './dto/portal-session.dto.js';
import { parseLineItems } from './line-item.schema.js';

/**
 * Admin only, and reachable while the company is suspended: a suspended company
 * keeps read access to what it owes and nothing else (`@AllowWhenSuspended()`).
 */
@ApiTags('billing')
@ApiBearerAuth()
@RequiresSubscription()
@AllowWhenSuspended()
@Roles('admin')
@RequireScopes('billing:read')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly billingIntents: BillingIntentService,
    private readonly context: RequestContextService,
  ) {}

  @Get('current')
  @ApiOkResponse({ type: StatementDto })
  async current(): Promise<StatementDto> {
    const statement = await this.billing.currentStatement();
    return toDto(StatementDto, {
      ...statement,
      // The calculator's own line-item type, re-validated on the way out.
      lineItems: parseLineItems(statement.lineItems),
    });
  }

  @Get('invoices')
  @ApiOkResponse({ type: InvoicePageDto })
  async invoices(@Query() query: OffsetQueryDto): Promise<InvoicePageDto> {
    return toDto(InvoicePageDto, mapPageData(await this.billing.listInvoices(query), InvoiceDto.from));
  }

  @Get('invoices/:id')
  @ApiOkResponse({ type: InvoiceDto })
  async invoice(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceDto> {
    return InvoiceDto.from(await this.billing.getInvoice(id));
  }

  @Post('portal-session')
  @HttpCode(200)
  @ApiOkResponse({ type: PortalSessionDto })
  async portalSession(): Promise<PortalSessionDto> {
    const url = await this.billingIntents.portalUrl(this.context.requireCompanyId());
    return toDto(PortalSessionDto, { url });
  }
}
