import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '@/core/core.module';
import { Order, OrderSchema } from '@/orders/schemas/order.schema';
import { AdminReturnsController } from './admin-returns.controller';
import { ApproveReturnHandler } from './commands/handlers/approve-return.handler';
import { ReceiveReturnHandler } from './commands/handlers/receive-return.handler';
import { RefundReturnHandler } from './commands/handlers/refund-return.handler';
import { RejectReturnHandler } from './commands/handlers/reject-return.handler';
import { RequestReturnHandler } from './commands/handlers/request-return.handler';
import { Return, ReturnSchema } from './schemas/return.schema';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

const COMMAND_HANDLERS = [
  RequestReturnHandler,
  ApproveReturnHandler,
  RejectReturnHandler,
  ReceiveReturnHandler,
  RefundReturnHandler,
];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: Return.name, schema: ReturnSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [ReturnsController, AdminReturnsController],
  providers: [ReturnsService, ...COMMAND_HANDLERS],
})
export class ReturnsModule {}
