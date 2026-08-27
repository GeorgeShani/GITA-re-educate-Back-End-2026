import { CreateTaxRateDto } from '../dto/create-tax-rate.dto';

export class CreateTaxRateCommand {
  constructor(
    readonly dto: CreateTaxRateDto,
    readonly correlationId: string,
  ) {}
}
