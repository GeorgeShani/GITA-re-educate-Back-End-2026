import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Homework 27 API - Users, Expenses & Products with aggregation statistics (MongoDB, JWT Auth, Rate Limiting)';
  }
}
