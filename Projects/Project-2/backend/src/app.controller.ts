import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health-check / welcome endpoint' })
  @ApiOkResponse({ description: 'Returns a greeting string', type: String })
  getHello(): string {
    return this.appService.getHello();
  }
}
