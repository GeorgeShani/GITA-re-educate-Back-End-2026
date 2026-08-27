import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TaxRate, TaxRateDocument } from './schemas/tax-rate.schema';

const BASIS_POINTS_DENOMINATOR = 10_000; // 1 basis point = 1/100 of a percent

@Injectable()
export class TaxService {
  constructor(
    @InjectModel(TaxRate.name)
    private readonly taxRateModel: Model<TaxRateDocument>,
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
}
