import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { AdjustStockCommand } from './commands/adjust-stock.command';
import { CreateBackInStockRequestDto } from './dto/create-back-in-stock-request.dto';
import {
  BackInStockRequest,
  BackInStockRequestDocument,
} from './schemas/back-in-stock-request.schema';
import {
  InventoryItem,
  InventoryItemDocument,
} from './schemas/inventory-item.schema';

export interface StockAvailability {
  quantityAvailable: number;
  inStock: boolean;
  backorderAllowed: boolean;
  lowStock: boolean;
}

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name)
    private readonly inventoryItemModel: Model<InventoryItemDocument>,
    @InjectModel(BackInStockRequest.name)
    private readonly backInStockRequestModel: Model<BackInStockRequestDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async checkStock(
    productId: string,
    variantSku: string,
  ): Promise<StockAvailability> {
    const item = await this.inventoryItemModel.findOne({
      productId: new Types.ObjectId(productId),
      variantSku: variantSku.toUpperCase(),
    });

    if (!item) {
      throw new NotFoundException(
        `No inventory record for ${productId}/${variantSku}`,
      );
    }

    const quantityAvailable = item.quantityOnHand - item.quantityReserved;
    return {
      quantityAvailable,
      inStock: quantityAvailable > 0,
      backorderAllowed: item.backorderAllowed,
      lowStock:
        quantityAvailable > 0 && quantityAvailable <= item.lowStockThreshold,
    };
  }

  /** Idempotent — resubmitting the same (product, variant, email) is a silent no-op, not an error. */
  async requestBackInStock(
    dto: CreateBackInStockRequestDto,
  ): Promise<{ requested: true }> {
    try {
      await this.backInStockRequestModel.create({
        productId: new Types.ObjectId(dto.productId),
        variantSku: dto.variantSku?.toUpperCase(),
        email: dto.email,
      });
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }
    }
    return { requested: true };
  }

  /** Admin manual correction — TransactionalCommandHandler, see AdjustStockHandler. */
  adjustStock(
    inventoryItemId: string,
    delta: number,
    reasonCode: string,
    note: string | undefined,
    adjustedByUserId: string,
  ): Promise<InventoryItemDocument> {
    return this.commandBus.execute(
      new AdjustStockCommand(
        inventoryItemId,
        delta,
        reasonCode,
        note,
        adjustedByUserId,
        this.correlationId(),
      ),
    );
  }

  /** Backs the dashboard's low-stock tile and its own admin list route. */
  findLowStock(limit = 50): Promise<InventoryItemDocument[]> {
    return this.inventoryItemModel
      .find({ $expr: { $lte: ['$quantityOnHand', '$lowStockThreshold'] } })
      .limit(limit)
      .exec();
  }

  findAllAdmin(): Promise<InventoryItemDocument[]> {
    return this.inventoryItemModel.find({}).exec();
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === MONGO_DUPLICATE_KEY_ERROR
    );
  }
}
