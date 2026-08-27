import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { EmailCategory } from './schemas/email-message.schema';
import {
  NotificationPreference,
  NotificationPreferenceDocument,
} from './schemas/notification-preference.schema';

// Transactional/security/ops are never opt-out-able (see
// notification-preference.schema.ts) — this service only ever moves
// 'marketing'/'opt-in' in or out of the list, never the always-on three.
const ALWAYS_ON_CATEGORIES: EmailCategory[] = [
  'transactional',
  'security',
  'ops',
];
const MARKETING_CATEGORIES: EmailCategory[] = ['marketing', 'opt-in'];

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly preferenceModel: Model<NotificationPreferenceDocument>,
  ) {}

  async findOrCreate(userId: string): Promise<NotificationPreferenceDocument> {
    const existing = await this.preferenceModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (existing) return existing;

    return this.preferenceModel.create({
      userId: new Types.ObjectId(userId),
    });
  }

  async setMarketingOptIn(
    userId: string,
    optedIn: boolean,
  ): Promise<NotificationPreferenceDocument> {
    const preference = await this.findOrCreate(userId);
    preference.optedInCategories = optedIn
      ? [...ALWAYS_ON_CATEGORIES, ...MARKETING_CATEGORIES]
      : [...ALWAYS_ON_CATEGORIES];
    await preference.save();
    return preference;
  }
}
