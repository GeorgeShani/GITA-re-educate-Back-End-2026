import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import { convert as htmlToText } from 'html-to-text';

const TEMPLATES_DIR = join(__dirname, 'templates');

export interface RenderedEmail {
  html: string;
  text: string;
}

// SCOPE.md B4 — "MJML -> compiled HTML at build time, Handlebars for
// interpolation." The MJML structural compile (tags -> tables) runs once
// per template and is cached; Handlebars fills in per-send variables
// against that cached HTML, so a busy queue isn't re-parsing MJML on
// every job. Design tokens are inlined as literal hex directly in the
// .mjml source (SCOPE.md A3 values) rather than through a separate
// substitution pass — with only two templates, a token-pipeline
// abstraction isn't earning its keep yet.
@Injectable()
export class TemplateRendererService {
  private readonly htmlCache = new Map<string, string>();

  async render(templateName: string, variables: Record<string, unknown>): Promise<RenderedEmail> {
    const compiledHtml = await this.getCompiledHtml(templateName);
    const html = Handlebars.compile(compiledHtml)(variables);
    const text = this.renderText(templateName, variables, html);
    return { html, text };
  }

  private async getCompiledHtml(templateName: string): Promise<string> {
    const cached = this.htmlCache.get(templateName);
    if (cached) return cached;

    const mjmlPath = join(TEMPLATES_DIR, `${templateName}.mjml`);
    if (!existsSync(mjmlPath)) {
      throw new InternalServerErrorException(`No email template named "${templateName}"`);
    }

    const { html, errors } = await mjml2html(readFileSync(mjmlPath, 'utf8'));
    if (errors.length > 0) {
      throw new InternalServerErrorException(
        `MJML compile errors in "${templateName}": ${errors.map((e) => e.formattedMessage).join('; ')}`,
      );
    }

    this.htmlCache.set(templateName, html);
    return html;
  }

  // Hand-authored .txt.hbs is the primary path (a deliberately written
  // plain-text part reads better than a stripped-tag dump); html-to-text
  // is the fallback for a template that hasn't written one yet.
  private renderText(
    templateName: string,
    variables: Record<string, unknown>,
    renderedHtml: string,
  ): string {
    const textPath = join(TEMPLATES_DIR, `${templateName}.txt.hbs`);
    if (existsSync(textPath)) {
      return Handlebars.compile(readFileSync(textPath, 'utf8'))(variables);
    }
    return htmlToText(renderedHtml, { wordwrap: 80 });
  }
}
