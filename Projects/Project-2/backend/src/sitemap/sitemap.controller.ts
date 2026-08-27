import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { SitemapService } from './sitemap.service';

// Excluded from Swagger — these aren't API resources, they're crawler
// contracts expected at fixed root paths (excluded from the api/v1
// prefix in main.ts, same treatment as /health).
@ApiExcludeController()
@Controller()
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  @Get('sitemap.xml')
  async sitemap(@Res() res: Response): Promise<void> {
    const xml = await this.sitemapService.getSitemapXml();
    res.type('application/xml').send(xml);
  }

  @Get('robots.txt')
  robots(@Res() res: Response): void {
    res.type('text/plain').send(this.sitemapService.getRobotsTxt());
  }
}
