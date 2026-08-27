import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminPagesController } from './admin-pages.controller';
import { PagesService } from './pages.service';
import { Page, PageSchema } from './schemas/page.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Page.name, schema: PageSchema }]),
  ],
  controllers: [AdminPagesController],
  providers: [PagesService],
})
export class PagesModule {}
