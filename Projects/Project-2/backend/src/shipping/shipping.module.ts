import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  ShippingZone,
  ShippingZoneSchema,
} from './schemas/shipping-zone.schema';
import { ShippingService } from './shipping.service';

// No controller — SCOPE.md doesn't call for a standalone shipping-rates
// browsing endpoint, only checkout-time quoting, so this stays a plain
// service CheckoutModule (S9) imports directly.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShippingZone.name, schema: ShippingZoneSchema },
    ]),
  ],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
