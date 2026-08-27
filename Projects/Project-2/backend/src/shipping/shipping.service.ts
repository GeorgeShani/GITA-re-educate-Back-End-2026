import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  ShippingRate,
  ShippingZone,
  ShippingZoneDocument,
} from './schemas/shipping-zone.schema';

export interface ShippingQuote {
  method: string;
  priceMinor: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
}

@Injectable()
export class ShippingService {
  constructor(
    @InjectModel(ShippingZone.name)
    private readonly zoneModel: Model<ShippingZoneDocument>,
  ) {}

  async getQuotes(
    countryCode: string,
    weightGrams: number,
    subtotalMinor: number,
  ): Promise<ShippingQuote[]> {
    const zone = await this.zoneModel
      .findOne({ countryCodes: countryCode.toUpperCase(), isActive: true })
      .exec();
    if (!zone) {
      throw new NotFoundException(`No shipping zone covers "${countryCode}"`);
    }

    return zone.rates
      .filter((rate) => this.rateAppliesToWeight(rate, weightGrams))
      .map((rate) => ({
        method: rate.method,
        priceMinor: this.priceFor(rate, subtotalMinor),
        estimatedDaysMin: rate.estimatedDaysMin,
        estimatedDaysMax: rate.estimatedDaysMax,
      }));
  }

  /** Used at order-placement time to freeze the exact rate chosen at quote time onto the order. */
  async getRate(
    countryCode: string,
    method: string,
    weightGrams: number,
    subtotalMinor: number,
  ): Promise<number> {
    const quotes = await this.getQuotes(
      countryCode,
      weightGrams,
      subtotalMinor,
    );
    const quote = quotes.find((q) => q.method === method);
    if (!quote) {
      throw new NotFoundException(
        `Shipping method "${method}" is not available for this address`,
      );
    }
    return quote.priceMinor;
  }

  private rateAppliesToWeight(
    rate: ShippingRate,
    weightGrams: number,
  ): boolean {
    if (rate.minWeightGrams !== undefined && weightGrams < rate.minWeightGrams)
      return false;
    if (rate.maxWeightGrams !== undefined && weightGrams > rate.maxWeightGrams)
      return false;
    return true;
  }

  private priceFor(rate: ShippingRate, subtotalMinor: number): number {
    if (
      rate.freeAboveSubtotalMinor !== undefined &&
      subtotalMinor >= rate.freeAboveSubtotalMinor
    ) {
      return 0;
    }
    return rate.priceMinor;
  }
}
