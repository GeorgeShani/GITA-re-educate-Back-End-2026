import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { CreateTaxRateCommand } from './commands/create-tax-rate.command';
import { UpdateTaxRateCommand } from './commands/update-tax-rate.command';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { TaxRate, TaxRateDocument } from './schemas/tax-rate.schema';

const BASIS_POINTS_DENOMINATOR = 10_000; // 1 basis point = 1/100 of a percent

@Injectable()
export class TaxService {
  constructor(
    @InjectModel(TaxRate.name)
    private readonly taxRateModel: Model<TaxRateDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  /** Region-specific rate wins over a country-wide one; no match at all -> untaxed (0). */
  async calculateTax(
    subtotalMinor: number,
    countryCode: string,
    region?: string,
  ): Promise<number> {
    const rate = await this.findRate(countryCode, region);
    if (!rate) return 0;
    return Math.round(
      (subtotalMinor * rate.rateBasisPoints) / BASIS_POINTS_DENOMINATOR,
    );
  }

  private async findRate(
    countryCode: string,
    region?: string,
  ): Promise<TaxRateDocument | null> {
    const country = countryCode.toUpperCase();

    if (region) {
      const regional = await this.taxRateModel
        .findOne({ countryCode: country, region, isActive: true })
        .exec();
      if (regional) return regional;
    }

    return this.taxRateModel
      .findOne({
        countryCode: country,
        region: { $exists: false },
        isActive: true,
      })
      .exec();
  }

  findAllAdmin(): Promise<TaxRateDocument[]> {
    return this.taxRateModel.find({}).exec();
  }

  async findByIdAdmin(taxRateId: string): Promise<TaxRateDocument> {
    const taxRate = await this.taxRateModel.findById(taxRateId).exec();
    if (!taxRate) {
      throw new NotFoundException(`Tax rate with id ${taxRateId} not found`);
    }
    return taxRate;
  }

  create(dto: CreateTaxRateDto): Promise<TaxRateDocument> {
    return this.commandBus.execute(
      new CreateTaxRateCommand(dto, this.correlationId()),
    );
  }

  update(taxRateId: string, dto: UpdateTaxRateDto): Promise<TaxRateDocument> {
    return this.commandBus.execute(
      new UpdateTaxRateCommand(taxRateId, dto, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
