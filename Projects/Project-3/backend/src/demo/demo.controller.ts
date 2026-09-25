import { Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SessionDto } from '#/auth/dto/session.dto.js';
import { Public } from '#/common/auth/public.decorator.js';
import { toDto } from '#/common/response/to-dto.js';
import { StrictThrottle } from '#/throttling/strict-throttle.decorator.js';
import { DemoService } from './demo.service.js';

@ApiTags('auth')
@Controller('auth')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Public()
  @StrictThrottle(20)
  @Post('demo')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionDto })
  async login(@Headers('user-agent') userAgent: string | undefined): Promise<SessionDto> {
    return toDto(SessionDto, await this.demo.login({ userAgent }));
  }
}
