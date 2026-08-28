import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '@/core/core.module';
import { AdminGiftCardsController } from './admin-gift-cards.controller';
import { AdjustGiftCardBalanceHandler } from './commands/handlers/adjust-gift-card-balance.handler';
import { IssueGiftCardHandler } from './commands/handlers/issue-gift-card.handler';
import { UpdateGiftCardHandler } from './commands/handlers/update-gift-card.handler';
import { GiftCardsService } from './gift-cards.service';
import { GiftCard, GiftCardSchema } from './schemas/gift-card.schema';

const COMMAND_HANDLERS = [
  IssueGiftCardHandler,
  UpdateGiftCardHandler,
  AdjustGiftCardBalanceHandler,
];

// Bare schema with zero consumers until now (confirmed: nothing in
// checkout/cart references GiftCard at all) — this is the entire
// admin-management surface. Checkout redemption is a deliberate
// non-goal here, see admin-gift-cards.controller.ts.
@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: GiftCard.name, schema: GiftCardSchema },
    ]),
  ],
  controllers: [AdminGiftCardsController],
  providers: [GiftCardsService, ...COMMAND_HANDLERS],
})
export class GiftCardsModule {}
