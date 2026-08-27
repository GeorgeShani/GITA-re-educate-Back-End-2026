import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminContactController } from './admin-contact.controller';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import {
  ContactMessage,
  ContactMessageSchema,
} from './schemas/contact-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactMessage.name, schema: ContactMessageSchema },
    ]),
  ],
  controllers: [ContactController, AdminContactController],
  providers: [ContactService],
})
export class ContactModule {}
