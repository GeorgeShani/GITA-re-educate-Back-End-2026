import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Homework 22 API - Users & Expenses';
  }
}
