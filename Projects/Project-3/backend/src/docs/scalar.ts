import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Request, Response } from 'express';
import { CSP_NONCE_LOCALS_KEY } from './csp-nonce.js';

/**
 * Mounted at `/reference` — never `/docs`, which is reserved for the
 * frontend's MDX guides (see SCOPE.md, "Docker — one origin, five services").
 * Swagger UI is never mounted at all; `@nestjs/swagger` is used purely as the
 * generator that produces `document`.
 *
 * `theme: 'purple'` is a placeholder. The real Gridline `customCss` (built
 * from the design tokens) lands in Milestone 2's brand pass — inventing brand
 * colors here now, before that system exists, would just mean redoing it.
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
  app.use('/reference', (req: Request, res: Response) => {
    const nonce = res.locals[CSP_NONCE_LOCALS_KEY];
    apiReference({
      content: document,
      theme: 'purple',
      nonce: typeof nonce === 'string' ? nonce : undefined,
    })(req, res);
  });
}
