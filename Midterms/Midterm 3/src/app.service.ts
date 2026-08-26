import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Midterm 3 API is up. See /users and /total-users.';
  }
}
