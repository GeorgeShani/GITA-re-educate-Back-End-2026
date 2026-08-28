import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '@/catalog/products.service';
import { ApproveReturnCommand } from './commands/approve-return.command';
import { ReceiveReturnCommand } from './commands/receive-return.command';
import { RefundReturnCommand } from './commands/refund-return.command';
import { RejectReturnCommand } from './commands/reject-return.command';
import { RequestReturnCommand } from './commands/request-return.command';
import { ApproveReturnDto } from './dto/approve-return.dto';
import { FindReturnsAdminDto } from './dto/find-returns-admin.dto';
import { RequestReturnDto } from './dto/request-return.dto';
import { Return, ReturnDocument } from './schemas/return.schema';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectModel(Return.name)
    private readonly returnModel: Model<ReturnDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  request(userId: string, dto: RequestReturnDto): Promise<ReturnDocument> {
    return this.commandBus.execute<RequestReturnCommand, ReturnDocument>(
      new RequestReturnCommand(
        userId,
        dto.orderId,
        dto.items,
        this.correlationId(),
      ),
    );
  }

  findMine(userId: string): Promise<ReturnDocument[]> {
    return this.returnModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async findOwned(returnId: string, userId: string): Promise<ReturnDocument> {
    const found = await this.returnModel
      .findOne({ _id: returnId, userId })
      .exec();
    if (!found) {
      // 404, not 403 — same ownership convention as OrdersService.findOwned.
      throw new NotFoundException(`Return with id ${returnId} not found`);
    }
    return found;
  }

  async findAllAdmin(
    query: FindReturnsAdminDto,
  ): Promise<PaginatedResult<ReturnDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<ReturnDocument> = {};
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      this.returnModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.returnModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async findByIdAdmin(returnId: string): Promise<ReturnDocument> {
    const found = await this.returnModel.findById(returnId).exec();
    if (!found) {
      throw new NotFoundException(`Return with id ${returnId} not found`);
    }
    return found;
  }

  approve(returnId: string, dto: ApproveReturnDto): Promise<ReturnDocument> {
    return this.commandBus.execute(
      new ApproveReturnCommand(returnId, dto.adminNote, this.correlationId()),
    );
  }

  reject(returnId: string, adminNote: string): Promise<ReturnDocument> {
    return this.commandBus.execute(
      new RejectReturnCommand(returnId, adminNote, this.correlationId()),
    );
  }

  receive(returnId: string): Promise<ReturnDocument> {
    return this.commandBus.execute(
      new ReceiveReturnCommand(returnId, this.correlationId()),
    );
  }

  refund(returnId: string): Promise<ReturnDocument> {
    return this.commandBus.execute(
      new RefundReturnCommand(returnId, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
