import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TaxRate, TaxRateSchema } from './schemas/tax-rate.schema';
import { TaxService } from './tax.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TaxRate.name, schema: TaxRateSchema }]),
  ],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
