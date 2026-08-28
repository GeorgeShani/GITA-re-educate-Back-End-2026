import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ADMIN_ROLES } from '@/common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { ContactService } from './contact.service';
import { FindContactMessagesAdminDto } from './dto/find-contact-messages-admin.dto';

@ApiTags('admin-contact')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.content)
@Controller('admin/contact')
export class AdminContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @ApiOperation({
    summary: 'The inbox — contact messages, filterable by read state',
  })
  findAll(@Query() query: FindContactMessagesAdminDto) {
    return this.contactService.findAll(query);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a message read' })
  markRead(@Param('id', ParseObjectIdPipe) id: string) {
    return this.contactService.markRead(id);
  }
}
