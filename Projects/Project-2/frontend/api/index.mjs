// Wires Angular's compiled SSR server into a Vercel Node.js Function.
// Vercel's Angular preset builds and serves dist/3legant/browser as
// static files on its own, but has no first-party adapter for a custom
// src/server.ts entry — without this, every request that doesn't match
// a static asset (i.e. every real route: /shop, /product/x, /) 404s
// before Angular ever gets to render it. See vercel.json's rewrite,
// which sends exactly those requests here.
// .mjs, not .js: package.json has no "type": "module", and this file
// needs both `export default` and a dynamic `import()`.
export default async (req, res) => {
  const { reqHandler } = await import('../dist/3legant/server/server.mjs');
  return reqHandler(req, res);
};
