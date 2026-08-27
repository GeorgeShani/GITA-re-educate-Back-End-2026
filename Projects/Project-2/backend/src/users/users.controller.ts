import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import { ClsService } from 'nestjs-cls';

import { AddressDto } from '../common/dto/address.dto';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';
import { AccountExportService } from './account-export.service';
import { DeleteAccountCommand } from './commands/delete-account.command';
import { UpdateProfileCommand } from './commands/update-profile.command';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

// GET /me itself stays on AuthController (S5) — it's what resolves "who
// is this request" in the first place. Everything that mutates or
// exports the account lives here instead.
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountExportService: AccountExportService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  @Throttle(WRITE_THROTTLE)
  @Patch()
  @ApiOperation({ summary: "Update the authenticated user's profile" })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser('userId') userId: string,
  ) {
    await this.commandBus.execute(
      new UpdateProfileCommand(
        userId,
        dto.firstName,
        dto.lastName,
        dto.phone,
        this.correlationId(),
      ),
    );
    return this.usersService.findById(userId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Permanently anonymize the account (GDPR right to erasure) — orders and reviews are kept as frozen historical records',
  })
  async deleteAccount(@CurrentUser('userId') userId: string): Promise<void> {
    await this.commandBus.execute(
      new DeleteAccountCommand(userId, this.correlationId()),
    );
  }

  @Get('export')
  @ApiOperation({
    summary:
      'Export the personal data held about the account (GDPR right to access)',
  })
  async exportData(@CurrentUser('userId') userId: string) {
    return this.accountExportService.export(userId);
  }

  @Get('addresses')
  @ApiOperation({ summary: "The authenticated user's saved addresses" })
  async listAddresses(@CurrentUser('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    return user.addresses;
  }

  @Throttle(WRITE_THROTTLE)
  @Post('addresses')
  @ApiOperation({ summary: 'Add a new address to the address book' })
  async addAddress(
    @Body() dto: AddressDto,
    @CurrentUser('userId') userId: string,
  ) {
    const user = await this.usersService.addAddress(userId, dto);
    return user.addresses;
  }

  @Throttle(WRITE_THROTTLE)
  @Patch('addresses/:addressId')
  @ApiOperation({ summary: 'Update an existing address' })
  async updateAddress(
    @Param('addressId', ParseObjectIdPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
    @CurrentUser('userId') userId: string,
  ) {
    const user = await this.usersService.updateAddress(userId, addressId, dto);
    return user.addresses;
  }

  @Throttle(WRITE_THROTTLE)
  @Delete('addresses/:addressId')
  @ApiOperation({ summary: 'Remove an address' })
  async removeAddress(
    @Param('addressId', ParseObjectIdPipe) addressId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const user = await this.usersService.removeAddress(userId, addressId);
    return user.addresses;
  }

  @Get('notification-preferences')
  @ApiOperation({ summary: 'Email notification preferences' })
  async getNotificationPreferences(@CurrentUser('userId') userId: string) {
    return this.notificationPreferencesService.findOrCreate(userId);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch('notification-preferences')
  @ApiOperation({ summary: 'Opt in or out of marketing email' })
  async updateNotificationPreferences(
    @Body() dto: UpdateNotificationPreferencesDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.notificationPreferencesService.setMarketingOptIn(
      userId,
      dto.marketingOptIn,
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
