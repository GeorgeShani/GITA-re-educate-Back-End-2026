import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * Per-route render modes. The previous blanket `**` -> Server is wrong for a
 * storefront: it gives up prerendering on the pages that most want it, and
 * server-renders session-scoped pages whose output can never be shared.
 *
 *   Prerender — static or slow-changing content, no per-request state.
 *   Server    — data-driven and SEO-critical, so it must be fresh per request.
 *   Client    — session-scoped. There is nothing meaningful to render without
 *               the user's token or cart cookie, so rendering it on the server
 *               only produces a skeleton the client immediately replaces.
 */
export const serverRoutes: ServerRoute[] = [
  // Server, not Prerender: home renders live featured products, so
  // prerendering would bake the catalog in at build time and serve it stale
  // until the next deploy.
  { path: '', renderMode: RenderMode.Server },
  { path: 'styleguide', renderMode: RenderMode.Client },

  // Auth: no SEO value, and a form holding a password has no business
  // being rendered on the server. Entries are added one at a time as each
  // route lands below — Angular SSR fails the build on a server-route
  // entry that matches nothing in the client routing config.
  { path: 'sign-in', renderMode: RenderMode.Client },
  { path: 'sign-up', renderMode: RenderMode.Client },
  { path: 'forgot-password', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },
  { path: 'verify-email', renderMode: RenderMode.Client },

  // Everything else — including the 404 — is server-rendered so crawlers get
  // real markup rather than an empty shell.
  { path: '**', renderMode: RenderMode.Server },

  // NOTE: Angular SSR validates every entry here against the client routing
  // config and fails the build on one that matches nothing. So the
  // session-scoped Client entries (cart, checkout/**, account/**, admin/**)
  // are added in the same slice that adds the route itself, not reserved
  // ahead of time.
];
