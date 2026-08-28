import { Injectable } from '@nestjs/common';

export interface WelcomeInfo {
  name: string;
  version: string;
  docs: string;
}

@Injectable()
export class AppService {
  getWelcome(): WelcomeInfo {
    return {
      name: '3legant Golf API',
      version: process.env.npm_package_version ?? '0.0.1',
      docs: '/api',
    };
  }
}
