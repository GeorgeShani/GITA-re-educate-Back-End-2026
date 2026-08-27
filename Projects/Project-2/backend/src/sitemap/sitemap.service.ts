import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { Product, ProductDocument } from '../catalog/schemas/product.schema';
import { Post, PostDocument } from '../blog/schemas/post.schema';
import { Page, PageDocument } from '../pages/schemas/page.schema';

interface SitemapUrl {
  path: string;
  updatedAt: Date;
}

// Cron-regenerated and cached in memory, same "regenerate on a
// schedule, serve the cached result" shape as StaleOrderSweepService's
// own @Cron usage — one Mongo read on a timer beats one on every crawler
// hit, and a sitemap a few minutes stale is never a correctness problem.
@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);
  private cachedXml: string | null = null;

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Page.name) private readonly pageModel: Model<PageDocument>,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async regenerate(): Promise<void> {
    this.cachedXml = await this.buildSitemap();
    this.logger.log('Regenerated sitemap.xml');
  }

  async getSitemapXml(): Promise<string> {
    // Covers the window before the first cron tick (e.g. right after boot).
    if (!this.cachedXml) {
      this.cachedXml = await this.buildSitemap();
    }
    return this.cachedXml;
  }

  getRobotsTxt(): string {
    const appUrl = this.configService.get<string>('APP_URL');
    const lines = ['User-agent: *', 'Allow: /'];
    if (appUrl) lines.push(`Sitemap: ${appUrl}/sitemap.xml`);
    return lines.join('\n');
  }

  private async buildSitemap(): Promise<string> {
    const appUrl = this.configService.get<string>('APP_URL') ?? '';

    const [products, posts, pages] = await Promise.all([
      this.productModel
        .find({ publishedAt: { $ne: null } })
        .select('slug')
        .exec(),
      this.postModel
        .find({ publishedAt: { $ne: null, $lte: new Date() } })
        .select('slug')
        .exec(),
      this.pageModel.find({}).select('slug').exec(),
    ]);

    const urls: SitemapUrl[] = [
      ...products.map((p) => ({
        path: `/product/${p.slug}`,
        updatedAt: p.get('updatedAt') as Date,
      })),
      ...posts.map((p) => ({
        path: `/blog/${p.slug}`,
        updatedAt: p.get('updatedAt') as Date,
      })),
      ...pages.map((p) => ({
        path: `/${p.slug}`,
        updatedAt: p.get('updatedAt') as Date,
      })),
    ];

    const entries = urls
      .map(
        (url) =>
          `  <url><loc>${appUrl}${url.path}</loc><lastmod>${url.updatedAt.toISOString()}</lastmod></url>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
  }
}
