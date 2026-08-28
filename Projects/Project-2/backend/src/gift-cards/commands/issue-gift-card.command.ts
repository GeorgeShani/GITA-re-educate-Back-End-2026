import { IssueGiftCardDto } from '@/gift-cards/dto/issue-gift-card.dto';

export class IssueGiftCardCommand {
  constructor(
    readonly dto: IssueGiftCardDto,
    readonly correlationId: string,
  ) {}
}
