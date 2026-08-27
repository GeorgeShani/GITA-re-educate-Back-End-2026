import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import {
  RefreshToken,
  RefreshTokenSchema,
} from '../auth/schemas/refresh-token.schema';
import { CoreModule } from '../core/core.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import {
  WishlistItem,
  WishlistItemSchema,
} from '../wishlist/schemas/wishlist-item.schema';
import { AccountExportService } from './account-export.service';
import { AdminUsersController } from './admin-users.controller';
import { DeleteAccountHandler } from './commands/handlers/delete-account.handler';
import { SetUserBannedHandler } from './commands/handlers/set-user-banned.handler';
import { UpdateProfileHandler } from './commands/handlers/update-profile.handler';
import { UpdateUserRolesHandler } from './commands/handlers/update-user-roles.handler';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const COMMAND_HANDLERS = [
  UpdateProfileHandler,
  DeleteAccountHandler,
  SetUserBannedHandler,
  UpdateUserRolesHandler,
];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: WishlistItem.name, schema: WishlistItemSchema },
    ]),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, AccountExportService, ...COMMAND_HANDLERS],
  exports: [UsersService],
})
export class UsersModule {}
