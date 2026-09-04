import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from '../../src/app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('returns the API description string', () => {
      expect(service.getHello()).toBe(
        'Homework 29 API - Movies & Directors CRUD (MySQL, TypeORM, Pagination & Filtering)',
      );
    });

    it('always returns a non-empty string', () => {
      expect(typeof service.getHello()).toBe('string');
      expect(service.getHello().length).toBeGreaterThan(0);
    });
  });
});
