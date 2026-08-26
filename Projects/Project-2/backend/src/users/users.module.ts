import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';

// No controller yet — profile/address CRUD is S10's job. This module
// exists in S5 purely so AuthModule has UsersService to build on; /me
// lives on AuthController for now (auth is what resolves "who is this
// request" in the first place).
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
