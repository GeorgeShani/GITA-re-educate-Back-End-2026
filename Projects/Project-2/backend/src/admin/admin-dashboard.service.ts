import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuditLogEntryDocument } from '@/core/audit-log/audit-log-entry.schema';
import { AuditLogService } from '@/core/audit-log/audit-log.service';
import {
  InventoryItem,
  InventoryItemDocument,
} from '@/inventory/schemas/inventory-item.schema';
import { OrderStatus } from '@/orders/enums/order-status.enum';
import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

const DEFAULT_RANGE_DAYS = 30;
const LOW_STOCK_LIMIT = 20;
const RECENT_ACTIVITY_LIMIT = 20;

// Only orders that were actually paid count toward revenue — PLACED
// (payment not yet confirmed) and CANCELLED/PAYMENT_FAILED never should.
const REVENUE_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.FULFILLED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export interface DashboardTimePoint {
  /** UTC calendar day, `YYYY-MM-DD`. */
  date: string;
  revenueMinor: number;
  orderCount: number;
}

export interface DashboardStatusCount {
  status: OrderStatus;
  count: number;
}

export interface DashboardSummary {
  from: Date;
  to: Date;
  revenueMinor: number;
  orderCount: number;
  averageOrderValueMinor: number;
  /** One entry per UTC day in [from, to], gaps zero-filled — for the trend chart. */
  revenueByDay: DashboardTimePoint[];
  /** Every status that appears in the range, descending by count — for the breakdown chart. */
  ordersByStatus: DashboardStatusCount[];
  lowStock: InventoryItemDocument[];
  recentActivity: AuditLogEntryDocument[];
}

// SCOPE.md Phase 6's "Dashboard" row, minus the chart/tiles UI — this is
// the data those tiles would read. The activity feed is deliberately not
// its own mechanism: it's just AuditLogService.findRecent, exactly as the
// SCOPE.md row itself specifies ("live activity feed read straight from
// the audit log").
@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryItemModel: Model<InventoryItemDocument>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getSummary(query: DashboardSummaryQueryDto): Promise<DashboardSummary> {
    const { from, to } = this.resolveRange(query);

    const [revenueResult, revenueByDayResult, ordersByStatusResult, lowStock, recentActivity] =
      await Promise.all([
        this.orderModel.aggregate<{ revenueMinor: number; orderCount: number }>([
          {
            $match: {
              status: { $in: REVENUE_STATUSES },
              createdAt: { $gte: from, $lte: to },
            },
          },
          {
            $group: {
              _id: null,
              revenueMinor: { $sum: '$totalMinor' },
              orderCount: { $sum: 1 },
            },
          },
        ]),
        this.orderModel.aggregate<{
          _id: string;
          revenueMinor: number;
          orderCount: number;
        }>([
          {
            $match: {
              status: { $in: REVENUE_STATUSES },
              createdAt: { $gte: from, $lte: to },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: 'UTC',
                },
              },
              revenueMinor: { $sum: '$totalMinor' },
              orderCount: { $sum: 1 },
            },
          },
        ]),
        this.orderModel.aggregate<{ _id: OrderStatus; count: number }>([
          { $match: { createdAt: { $gte: from, $lte: to } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        this.inventoryItemModel
          .find({ $expr: { $lte: ['$quantityOnHand', '$lowStockThreshold'] } })
          .limit(LOW_STOCK_LIMIT)
          .exec(),
        this.auditLogService.findRecent(RECENT_ACTIVITY_LIMIT),
      ]);

    const revenueMinor = revenueResult[0]?.revenueMinor ?? 0;
    const orderCount = revenueResult[0]?.orderCount ?? 0;

    return {
      from,
      to,
      revenueMinor,
      orderCount,
      averageOrderValueMinor:
        orderCount > 0 ? Math.round(revenueMinor / orderCount) : 0,
      revenueByDay: this.zeroFillDays(from, to, revenueByDayResult),
      ordersByStatus: ordersByStatusResult.map((row) => ({
        status: row._id,
        count: row.count,
      })),
      lowStock,
      recentActivity,
    };
  }

  /**
   * Turns the sparse per-day aggregation into a continuous series — one
   * point for every UTC day in the range, days with no paid orders zeroed
   * — so the frontend chart's x-axis has no gaps to interpolate across.
   */
  private zeroFillDays(
    from: Date,
    to: Date,
    rows: { _id: string; revenueMinor: number; orderCount: number }[],
  ): DashboardTimePoint[] {
    const byDate = new Map(rows.map((row) => [row._id, row]));
    const points: DashboardTimePoint[] = [];
    const cursor = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
    );
    const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());

    // Guard against a pathological range (misordered/huge) producing an
    // unbounded loop — the dashboard only ever asks for 7/30/90 days.
    for (let guard = 0; cursor.getTime() <= end && guard < 400; guard += 1) {
      const key = cursor.toISOString().slice(0, 10);
      const row = byDate.get(key);
      points.push({
        date: key,
        revenueMinor: row?.revenueMinor ?? 0,
        orderCount: row?.orderCount ?? 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return points;
  }

  private resolveRange(query: DashboardSummaryQueryDto): {
    from: Date;
    to: Date;
  } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
  }
}
