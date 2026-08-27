import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '../core/core.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { RequestReturnHandler } from './commands/handlers/request-return.handler';
import { Return, ReturnSchema } from './schemas/return.schema';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

const COMMAND_HANDLERS = [RequestReturnHandler];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: Return.name, schema: ReturnSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService, ...COMMAND_HANDLERS],
})
export class ReturnsModule {}
