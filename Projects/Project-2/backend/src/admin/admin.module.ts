import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '@/core/core.module';
import {
  InventoryItem,
  InventoryItemSchema,
} from '@/inventory/schemas/inventory-item.schema';
import { Order, OrderSchema } from '@/orders/schemas/order.schema';
import { AdminAuditLogController } from './admin-audit-log.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

// Home for the two genuinely cross-cutting admin surfaces — the dashboard
// (aggregates Orders + Inventory + the audit log) and the audit-log
// viewer itself — that don't belong to any single existing feature
// module. Resource-scoped admin CRUD (products, orders, etc.) stays
// co-located in the module that already owns that resource, per
// backend/AGENTS.md; only these two, plus every genuinely new domain
// this phase adds (coupons, gift cards, blog, pages, contact,
// newsletter), get their own module.
@Module({
  imports: [
    CoreModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
    ]),
  ],
  controllers: [AdminDashboardController, AdminAuditLogController],
  providers: [AdminDashboardService],
})
export class AdminModule {}
