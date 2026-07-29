import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [UsersModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
