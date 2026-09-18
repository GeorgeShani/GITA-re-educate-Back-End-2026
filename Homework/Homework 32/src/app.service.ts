import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Homework 32 API - Users, Products, Auth & S3/CloudFront Photo Uploads (MySQL, TypeORM)';
  }
}
