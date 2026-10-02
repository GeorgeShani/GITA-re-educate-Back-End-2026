import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MailMessage } from './mail-message.js';
import {
  SAMPLE_MESSAGES,
  SAMPLE_QUOTA_FULL,
  SAMPLE_SIGN_IN_REMOVED,
} from './sample-messages.js';
import { TemplateRenderer } from './template-renderer.js';

/**
 * `npm run mail:preview`: renders every email with sample data to `.mail-preview/`, one HTML file each plus an index that
 * shows them side by side, so each email can be opened in a browser (or sent to a client-testing tool) without sending
 * anything. Not part of the running application.
 */
const OUT = join(process.cwd(), '.mail-preview');

const VARIANTS: Array<{ file: string; note: string; message: MailMessage }> = [
  ...SAMPLE_MESSAGES.map((message) => ({
    file: message.template,
    note: '',
    message,
  })),
  {
    file: 'quota_threshold-100',
    note: 'at 100%',
    message: SAMPLE_QUOTA_FULL,
  },
  {
    file: 'sign_in_method_changed-removed',
    note: 'method removed',
    message: SAMPLE_SIGN_IN_REMOVED,
  },
];

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

async function main(): Promise<void> {
  const renderer = new TemplateRenderer({
    appUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3000',
    assetsUrl: process.env.ASSETS_BASE_URL || undefined,
  });
  await renderer.compile();
  mkdirSync(OUT, { recursive: true });

  const cards: string[] = [];
  for (const { file, note, message } of VARIANTS) {
    const email = renderer.render(message);
    writeFileSync(join(OUT, `${file}.html`), email.html, 'utf8');
    writeFileSync(join(OUT, `${file}.txt`), email.text, 'utf8');
    cards.push(`
      <section class="card" id="${file}">
        <header>
          <h2>${escapeHtml(message.template)}${note ? ` <small>${escapeHtml(note)}</small>` : ''}</h2>
          <p><span>Subject</span> ${escapeHtml(email.subject)}</p>
          <p><span>To</span> ${escapeHtml(email.to)}</p>
          <p class="links"><a href="${file}.html" target="_blank" rel="noopener">Open on its own</a> &middot; <a href="${file}.txt" target="_blank" rel="noopener">Plain-text part</a></p>
        </header>
        <iframe src="${file}.html" title="${escapeHtml(message.template)}" loading="lazy"></iframe>
      </section>`);
  }

  const nav = VARIANTS.map(
    ({ file }) => `<a href="#${file}">${escapeHtml(file)}</a>`,
  ).join('');
  const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gridline emails</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 15px/1.5 system-ui, sans-serif; background: #ece5d0; color: #191610; }
  header.top { position: sticky; top: 0; z-index: 2; background: #191610; color: #f8f5eb; padding: 12px 20px; display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; }
  header.top h1 { font-size: 16px; margin: 0 8px 0 0; }
  header.top nav { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; }
  header.top a { color: #f9cc21; text-decoration: none; }
  label { font-size: 13px; margin-left: auto; }
  main { display: grid; gap: 28px; padding: 24px 20px 60px; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); align-items: start; }
  .card { background: #fefbf3; border: 1px solid #dad0ba; border-radius: 4px; overflow: hidden; }
  .card header { padding: 14px 16px; border-bottom: 1px solid #dad0ba; }
  .card h2 { font-size: 15px; margin: 0 0 6px; font-family: ui-monospace, monospace; }
  .card h2 small { font-family: system-ui; font-weight: 400; color: #534c41; }
  .card p { margin: 2px 0; font-size: 13px; word-break: break-word; }
  .card p span { display: inline-block; width: 58px; color: #6b6254; }
  .card .links a { color: #191610; }
  iframe { display: block; width: 100%; height: 820px; border: 0; background: #f9f3e3; margin: 0 auto; }
  body.phone iframe { width: 375px; }
  body.phone main { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); }
</style>
</head>
<body>
<header class="top">
  <h1>Gridline emails (${VARIANTS.length})</h1>
  <nav>${nav}</nav>
  <label><input type="checkbox" id="phone"> Phone width</label>
</header>
<main>${cards.join('\n')}
</main>
<script>
  document.getElementById('phone').addEventListener('change', (event) => {
    document.body.classList.toggle('phone', event.target.checked);
  });
</script>
</body>
</html>`;
  writeFileSync(join(OUT, 'index.html'), index, 'utf8');
  console.log(`Wrote ${VARIANTS.length} emails to ${OUT}\nOpen ${join(OUT, 'index.html')}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
