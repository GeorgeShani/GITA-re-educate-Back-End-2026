// SCOPE.md B4 — `npm run mail:preview` renders every template with
// fixture data to dist/mail-preview/ for visual review. No provider, no
// database, no Nest bootstrap — TemplateRendererService has no DI
// dependencies of its own.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { TemplateRendererService } from '../src/notifications/template-renderer.service';
import { MAIL_FIXTURES } from './mail-fixtures';

async function main() {
  const renderer = new TemplateRendererService();
  const outDir = join(process.cwd(), 'dist', 'mail-preview');
  mkdirSync(outDir, { recursive: true });

  for (const [template, variables] of Object.entries(MAIL_FIXTURES)) {
    const { html, text } = await renderer.render(template, variables);
    writeFileSync(join(outDir, `${template}.html`), html, 'utf8');
    writeFileSync(join(outDir, `${template}.txt`), text, 'utf8');
    console.log(`Rendered "${template}" -> dist/mail-preview/${template}.html (+ .txt)`);
  }
}

void main();
