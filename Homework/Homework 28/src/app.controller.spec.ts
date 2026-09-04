import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns the API description', () => {
      expect(appController.getHello()).toBe(
        'Homework 28 API - Movies & Directors CRUD (MySQL, TypeORM, Pagination & Filtering)',
      );
    });
  });
});
