import { IssueGiftCardDto } from '../dto/issue-gift-card.dto';

export class IssueGiftCardCommand {
  constructor(
    readonly dto: IssueGiftCardDto,
    readonly correlationId: string,
  ) {}
}
