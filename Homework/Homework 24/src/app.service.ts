import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Homework 24 API - Users, Expenses & Products (MongoDB)';
  }
}
