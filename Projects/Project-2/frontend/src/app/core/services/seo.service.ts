import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const JSON_LD_SCRIPT_ID = 'structured-data';

const SITE_NAME = '3legant Golf';
const DEFAULT_DESCRIPTION =
  'More than just a game — golf clubs, apparel, and accessories for every level of player.';

export interface SeoData {
  /** Page-specific title — SITE_NAME is appended, callers never include it themselves. */
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
}

/**
 * Every page currently rendered with the same static <title>3legant</title>
 * from index.html and no per-page description or Open Graph tags at all —
 * a real SEO/link-preview gap (F12 Slice 9), not a nice-to-have. Meta and
 * Title are both root-provided by @angular/platform-browser already — no
 * extra provider wiring needed — and both are SSR-safe (they read/write
 * the same DOM node the server renders, so hydration picks up whatever
 * the last set() call before render produced).
 */
@Service()
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);

  set(data: SeoData): void {
    const fullTitle = `${data.title} — ${SITE_NAME}`;
    const description = data.description ?? DEFAULT_DESCRIPTION;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: data.type ?? 'website' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });

    if (data.image) {
      this.meta.updateTag({ property: 'og:image', content: data.image });
    } else {
      this.meta.removeTag('property="og:image"');
    }
  }

  /**
   * One script[type=application/ld+json] per page, keyed by a fixed id so
   * a route change replaces it rather than accumulating copies. Uses
   * DOCUMENT (SSR-safe) directly rather than Renderer2 — Renderer2 is
   * scoped to a component's own view by default and this is a plain
   * service, not a component; DOCUMENT resolves correctly in both the
   * server's DOM emulation and the real browser DOM. textContent, never
   * innerHTML: this is trusted data this app itself builds from a DTO,
   * but textContent is still the right tool for inserting text content
   * regardless — it can't be interpreted as markup even if it somehow
   * carried something unexpected.
   */
  setJsonLd(data: object): void {
    this.document.getElementById(JSON_LD_SCRIPT_ID)?.remove();

    const script = this.document.createElement('script');
    script.id = JSON_LD_SCRIPT_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    this.document.head.appendChild(script);
  }

  clearJsonLd(): void {
    this.document.getElementById(JSON_LD_SCRIPT_ID)?.remove();
  }

  /**
   * schema.org properties want absolute URLs. document.location (not
   * window.location) on purpose — @angular/ssr's DOCUMENT is synced to
   * the real incoming request's URL during server rendering, so this
   * resolves correctly there too, not just in the browser.
   */
  absoluteUrl(path: string): string {
    return new URL(path, this.document.location.origin).toString();
  }
}
