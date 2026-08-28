import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppService, type WelcomeInfo } from '@/app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API welcome endpoint — see /health for readiness' })
  @ApiOkResponse({ description: 'Basic API identification' })
  getWelcome(): WelcomeInfo {
    return this.appService.getWelcome();
  }
}
