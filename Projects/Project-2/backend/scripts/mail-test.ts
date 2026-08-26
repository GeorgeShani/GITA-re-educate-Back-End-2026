// SCOPE.md B4 — `npm run mail:test <template> <email>` sends one real
// email via Resend, regardless of MAIL_PROVIDER (that env var only
// controls the running app; this script's whole purpose is a live-send
// check, so it always talks to Resend directly).
import { Resend } from 'resend';

import { TemplateRendererService } from '../src/notifications/template-renderer.service';
import { MAIL_FIXTURES } from './mail-fixtures';

if (require('node:fs').existsSync('.env')) {
  process.loadEnvFile('.env'); // Node 20.6+ built-in, no dotenv dependency needed
}

async function main() {
  const [template, recipient] = process.argv.slice(2);
  if (!template || !recipient) {
    console.error('Usage: npm run mail:test <template> <email>');
    console.error(`Known templates: ${Object.keys(MAIL_FIXTURES).join(', ')}`);
    process.exit(1);
  }

  const variables = MAIL_FIXTURES[template];
  if (!variables) {
    console.error(`Unknown template "${template}". Known: ${Object.keys(MAIL_FIXTURES).join(', ')}`);
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set in .env');
    process.exit(1);
  }

  const renderer = new TemplateRendererService();
  const { html, text } = await renderer.render(template, variables);

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: `${process.env.MAIL_FROM_NAME ?? '3legant Golf'} <${process.env.MAIL_FROM}>`,
    to: recipient,
    subject: `[mail:test] ${template}`,
    html,
    text,
  });

  if (error) {
    console.error('Send failed:', error);
    process.exit(1);
  }
  console.log(`Sent "${template}" to ${recipient} — Resend id: ${data?.id}`);
}

void main();
