import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [UsersModule, ExpensesModule, ProductsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
