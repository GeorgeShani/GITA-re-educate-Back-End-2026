import { UpdateGiftCardDto } from '@/gift-cards/dto/update-gift-card.dto';

export class UpdateGiftCardCommand {
  constructor(
    readonly giftCardId: string,
    readonly dto: UpdateGiftCardDto,
    readonly correlationId: string,
  ) {}
}
