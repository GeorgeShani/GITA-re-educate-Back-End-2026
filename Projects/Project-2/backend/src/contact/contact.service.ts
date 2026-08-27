import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';

import { PaginatedResult } from '../catalog/products.service';
import { FindContactMessagesAdminDto } from './dto/find-contact-messages-admin.dto';
import { SubmitContactMessageDto } from './dto/submit-contact-message.dto';
import {
  ContactMessage,
  ContactMessageDocument,
} from './schemas/contact-message.schema';

// Plain CRUD, no CQRS — same reasoning as UsersService.addAddress:
// nothing else in the system reacts to a contact form submission, and
// the admin list/mark-read actions are simple housekeeping, not
// domain-significant transitions.
@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactMessage.name)
    private readonly contactMessageModel: Model<ContactMessageDocument>,
  ) {}

  submit(dto: SubmitContactMessageDto): Promise<ContactMessageDocument> {
    return this.contactMessageModel.create({
      name: dto.name,
      email: dto.email,
      subject: dto.subject,
      message: dto.message,
    });
  }

  async findAll(
    query: FindContactMessagesAdminDto,
  ): Promise<PaginatedResult<ContactMessageDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<ContactMessageDocument> = {};
    if (query.isRead !== undefined) filter.isRead = query.isRead;

    const [items, total] = await Promise.all([
      this.contactMessageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.contactMessageModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async markRead(messageId: string): Promise<ContactMessageDocument> {
    const message = await this.contactMessageModel
      .findByIdAndUpdate(messageId, { isRead: true }, { new: true })
      .exec();
    if (!message) {
      throw new NotFoundException(
        `Contact message with id ${messageId} not found`,
      );
    }
    return message;
  }
}
