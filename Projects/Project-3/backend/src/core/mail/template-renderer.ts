import Handlebars from 'handlebars';
import type { MailMessage, MailTemplateName, RenderedEmail } from './mail-message.js';
import { TEMPLATES } from './templates.js';

interface CompiledTemplate {
  subject: HandlebarsTemplateDelegate;
  text: HandlebarsTemplateDelegate;
  html: HandlebarsTemplateDelegate;
}

/**
 * Compiles every template once (MJML -> HTML, then Handlebars over that HTML)
 * and renders per send from the cache. Plain class, no Nest, so it can be unit
 * tested without booting anything. MJML 5 is asynchronous, hence `compile()`.
 *
 * MJML runs over the *source*, not per send: its output structure never
 * depends on the variables, and passes `{{expressions}}` through untouched
 * for Handlebars to fill afterwards. Doing it per send would pay MJML's
 * parsing cost on every email for identical output.
 */
export class TemplateRenderer {
  private readonly compiled = new Map<MailTemplateName, CompiledTemplate>();

  async compile(): Promise<void> {
    // Loaded here, not at the top of the file: mjml is heavy, and a static
    // import would make merely importing AppModule (docs generation, specs)
    // pay for it even when no email is ever rendered.
    const { default: mjml2html } = await import('mjml');

    for (const [name, definition] of Object.entries(TEMPLATES)) {
      if (!isTemplateName(name)) continue;

      const { html, errors } = await mjml2html(definition.mjml, { validationLevel: 'strict' });
      if (errors.length > 0) {
        const detail = errors.map((error) => error.formattedMessage).join('; ');
        throw new Error(`MJML template "${name}" is invalid: ${detail}`);
      }

      this.compiled.set(name, {
        // A subject and a plain-text body are not HTML: no entity escaping.
        subject: Handlebars.compile(definition.subject, { noEscape: true }),
        text: Handlebars.compile(definition.text, { noEscape: true }),
        html: Handlebars.compile(html),
      });
    }
  }

  render(message: MailMessage): RenderedEmail {
    const template = this.compiled.get(message.template);
    if (!template) {
      throw new Error(
        `Template "${message.template}" is not compiled — was compile() awaited at startup?`,
      );
    }

    return {
      to: message.to,
      subject: template.subject(message.vars),
      text: template.text(message.vars),
      html: template.html(message.vars),
    };
  }
}

function isTemplateName(value: string): value is MailTemplateName {
  return value in TEMPLATES;
}
