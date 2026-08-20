import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Homework 25 API - Users, Expenses & Products (MongoDB, JWT Auth)';
  }
}
