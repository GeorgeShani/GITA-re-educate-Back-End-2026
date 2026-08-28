import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { ContactService } from './contact.service';
import { SubmitContactMessageDto } from './dto/submit-contact-message.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Throttle(WRITE_THROTTLE)
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Submit a contact form message' })
  async submit(@Body() dto: SubmitContactMessageDto): Promise<void> {
    await this.contactService.submit(dto);
  }
}
