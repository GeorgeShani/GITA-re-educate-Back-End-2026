import { UpdateTaxRateDto } from '../dto/update-tax-rate.dto';

export class UpdateTaxRateCommand {
  constructor(
    readonly taxRateId: string,
    readonly dto: UpdateTaxRateDto,
    readonly correlationId: string,
  ) {}
}
