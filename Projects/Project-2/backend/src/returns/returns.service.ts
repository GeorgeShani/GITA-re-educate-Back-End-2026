import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { RequestReturnCommand } from './commands/request-return.command';
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

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
