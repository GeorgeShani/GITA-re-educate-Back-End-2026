import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema.js';
import { UsersResolver } from './users.resolver.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{
      name: User.name,
      schema: UserSchema
    }]),
  ],
  providers: [UsersService, UsersResolver],
  exports: [UsersService],
})
export class UsersModule {}
