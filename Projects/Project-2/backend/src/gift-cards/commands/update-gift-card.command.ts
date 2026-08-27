import { UpdateGiftCardDto } from '../dto/update-gift-card.dto';

export class UpdateGiftCardCommand {
  constructor(
    readonly giftCardId: string,
    readonly dto: UpdateGiftCardDto,
    readonly correlationId: string,
  ) {}
}
