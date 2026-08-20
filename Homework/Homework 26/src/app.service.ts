import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Homework 26 API - Users, Expenses & Products (MongoDB, JWT Auth, Rate Limiting)';
  }
}
