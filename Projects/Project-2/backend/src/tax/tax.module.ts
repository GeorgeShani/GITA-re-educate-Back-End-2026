import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '../core/core.module';
import { AdminTaxController } from './admin-tax.controller';
import { CreateTaxRateHandler } from './commands/handlers/create-tax-rate.handler';
import { UpdateTaxRateHandler } from './commands/handlers/update-tax-rate.handler';
import { TaxRate, TaxRateSchema } from './schemas/tax-rate.schema';
import { TaxService } from './tax.service';

const COMMAND_HANDLERS = [CreateTaxRateHandler, UpdateTaxRateHandler];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([{ name: TaxRate.name, schema: TaxRateSchema }]),
  ],
  controllers: [AdminTaxController],
  providers: [TaxService, ...COMMAND_HANDLERS],
  exports: [TaxService],
})
export class TaxModule {}
