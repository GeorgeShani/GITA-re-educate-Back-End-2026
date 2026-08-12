import { RenderMode, ServerRoute } from '@angular/ssr';

// app.routes.ts is still empty (routes land feature-by-feature in F4-F9),
// so there are no real paths to enumerate yet. What matters right now is
// the *default*: the scaffold's blanket `Prerender` on '**' would bake
// every future route — including data-driven ones like /product/:slug —
// into a static snapshot taken at build time. That's actively wrong for
// this app, not just suboptimal, so the safe default is Server.
//
// Each feature phase adds its own entry above the fallback once its real
// path exists:
//   - Static/content routes (home, blog, legal) -> RenderMode.Prerender
//   - Data-driven routes (shop, product, search) -> RenderMode.Server (default, can omit)
//   - Session-scoped routes (cart, checkout, account, admin) -> RenderMode.Client
//
// The /styleguide route (F0/F1, dev tool only) is the one path we can
// commit to right now.
export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'styleguide',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
