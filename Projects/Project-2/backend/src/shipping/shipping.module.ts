import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '../core/core.module';
import { AdminShippingController } from './admin-shipping.controller';
import { CreateShippingZoneHandler } from './commands/handlers/create-shipping-zone.handler';
import { UpdateShippingZoneHandler } from './commands/handlers/update-shipping-zone.handler';
import {
  ShippingZone,
  ShippingZoneSchema,
} from './schemas/shipping-zone.schema';
import { ShippingService } from './shipping.service';

const COMMAND_HANDLERS = [CreateShippingZoneHandler, UpdateShippingZoneHandler];

// CheckoutModule (S9) imports this for checkout-time quoting only —
// SCOPE.md never called for a standalone shopper-facing browsing
// endpoint. Phase 6 adds the first controller: admin zone/rate CRUD.
@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: ShippingZone.name, schema: ShippingZoneSchema },
    ]),
  ],
  controllers: [AdminShippingController],
  providers: [ShippingService, ...COMMAND_HANDLERS],
  exports: [ShippingService],
})
export class ShippingModule {}
