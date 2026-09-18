import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Explicit, not Nest's default. The default operationIdFactory produces
 * `${controllerKey}_${methodKey}` where `controllerKey` is literally
 * `constructor.name` (verified in the installed @nestjs/swagger source) — so
 * renaming a controller class silently orphans every prose entry keyed on the
 * old operationId. Setting the SAME template here explicitly doesn't remove
 * that risk (the factory only ever receives two strings — there is no path or
 * HTTP method available to build a rename-proof id from) — what it does is
 * make the format a decision this codebase owns and documents, rather than an
 * implicit framework default that could change on a Nest upgrade with no
 * warning. The actual mitigation is procedural: `docs:generate` fails,
 * loudly, naming the orphaned operationId — see prose.ts.
 */
function operationIdFactory(controllerKey: string, methodKey: string): string {
  return `${controllerKey}_${methodKey}`;
}

/**
 * `addServer('/api')` matters specifically because of how this app is
 * deployed: Caddy's `handle_path /api/*` strips that segment before
 * forwarding, so the app itself serves unprefixed routes, but the PUBLIC
 * origin a browser or Scalar's embedded client actually talks to is `/api`.
 * Without this, the try-it panel would POST to `<origin>/auth/login`, which
 * Caddy would then route to `web`, not `api` — a confusing 404 with no
 * indication the request went to the wrong service. The second server entry
 * covers hitting the bare backend directly in local non-Docker dev.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Gridline API')
    .setDescription(
      'Multi-tenant SaaS backend for spreadsheet upload, per-file permissions, and seat + usage billing.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addServer('/api')
    .addServer('http://localhost:4000')
    .build();

  return SwaggerModule.createDocument(app, config, { operationIdFactory });
}
