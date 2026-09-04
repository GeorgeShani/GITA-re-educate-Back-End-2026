import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Homework 29 API - Movies & Directors CRUD (MySQL, TypeORM, Pagination & Filtering)';
  }
}
