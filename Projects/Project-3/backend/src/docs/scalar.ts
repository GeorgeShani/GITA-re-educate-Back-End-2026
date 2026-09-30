import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Request, Response } from 'express';
import { CSP_NONCE_LOCALS_KEY } from './csp-nonce.js';
import { SCALAR_CUSTOM_CSS, SCALAR_FAVICON } from './scalar-theme.js';

/**
 * Options the reference renderer understands but the wrapper's bundled TypeScript types do not list yet. The renderer is
 * loaded from Scalar's CDN, so it is newer than `@scalar/nestjs-api-reference`'s types. `showToolbar: 'never'` removes the
 * top toolbar (theme picker, share, deploy).
 */
const NEWER_THAN_WRAPPER_TYPES: Record<string, unknown> = { showToolbar: 'never' };

/** Keeps a value safe inside a CSS string: letters, digits and a few separators only. */
function cssText(value: string): string {
  return value.replace(/[^0-9A-Za-z.+\- ]/g, '');
}

/**
 * The text of the two stamps under the title (see the title-block rules in the generated theme). It is read from the
 * document being served, so the version and the OpenAPI number are always the ones the reference is showing.
 */
function titleStamps(document: OpenAPIObject): string {
  return `
.introduction-section .section-header::before { content: "Version ${cssText(document.info.version)}"; }
.introduction-section .section-header::after { content: "OpenAPI ${cssText(document.openapi)}"; }
`;
}

/**
 * Mounted at `/reference` — never `/docs`, which is reserved for the
 * frontend's MDX guides (see SCOPE.md, "Docker — one origin, five services").
 * Swagger UI is never mounted at all; `@nestjs/swagger` is used purely as the
 * generator that produces `document`.
 *
 * The look is Gridline's own: `theme: 'none'` switches Scalar's built-in palette off and `SCALAR_CUSTOM_CSS` (generated
 * from `design/tokens.json`, the same source as the website and the emails) supplies colours, type and radii for light
 * and dark. `withDefaultFonts: false` stops Scalar loading its own Inter, since the theme brings Archivo, EB Garamond and
 * Martian Mono. The fonts come from Google Fonts, which the CSP already allows (`style-src`/`font-src` https:).
 *
 * The toolbar (theme picker, developer tools, share, deploy) and Scalar's hosted MCP button are switched off: the reference
 * is one fixed, branded page, and Gridline's own MCP server is not Scalar's.
 *
 * `apiReference(...)` is called fresh per request, not once at mount time —
 * its `content` closure is re-invoked on every hit (see
 * `@scalar/nestjs-api-reference`'s `apiReference` source: `res.send(content())`),
 * so this can hand it a different `nonce` — the one `main.ts`'s pre-helmet
 * middleware minted for this exact request and put in `res.locals` — every
 * time, matching whatever `script-src 'nonce-...'` that request's CSP header
 * actually carries.
 */
export function mountScalarReference(app: INestApplication, document: OpenAPIObject): void {
  const customCss = `${SCALAR_CUSTOM_CSS}\n${titleStamps(document)}`;
  app.use('/reference', (req: Request, res: Response) => {
    const nonce = res.locals[CSP_NONCE_LOCALS_KEY];
    apiReference({
      content: document,
      theme: 'none',
      customCss,
      withDefaultFonts: false,
      favicon: SCALAR_FAVICON,
      metaData: { title: 'Gridline API reference' },
      ...NEWER_THAN_WRAPPER_TYPES,
      showDeveloperTools: 'never',
      mcp: { disabled: true },
      telemetry: false,
      nonce: typeof nonce === 'string' ? nonce : undefined,
    })(req, res);
  });
}
