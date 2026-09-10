// One-off UI audit capture: drives the real dev site and screenshots every
// route at desktop + mobile widths. Output: ./ui-audit/<viewport>/<name>.(png)
// Usage: node ui-capture.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const API = 'http://localhost:4000/api/v1';
const APP = 'http://localhost:4200';
const OUT = process.env.UI_AUDIT_OUT || join(process.cwd(), 'ui-audit');

const CREDS = {
  admin: { email: 'admin@3legantgolf.com', password: 'Password123!' },
  customer: { email: 'james.whitaker@example.com', password: 'Password123!' },
};

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

async function login(who) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(CREDS[who]),
    });
    if (res.ok) return res.json();
    if (res.status === 429) {
      console.log(`  login ${who}: rate-limited, waiting 15s (attempt ${attempt + 1})`);
      await sleep(15000);
      continue;
    }
    throw new Error(`login ${who} failed: ${res.status}`);
  }
  throw new Error(`login ${who} failed: still rate-limited after retries`);
}

async function apiGet(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return res.json();
}

async function autoScroll(page) {
  // Trigger lazy images / IntersectionObserver reveals, then return to top.
  await page.evaluate(async () => {
    const step = () => new Promise((r) => setTimeout(r, 120));
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += Math.round(window.innerHeight * 0.8)) {
      window.scrollTo(0, y);
      await step();
    }
    window.scrollTo(0, 0);
    await step();
  });
  await sleep(400);
}

async function capture(context, viewport, name, path) {
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));
  try {
    const resp = await page.goto(`${APP}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(1200);
    await autoScroll(page);
    await sleep(600);
    const dir = join(OUT, viewport);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, name + '.png'), fullPage: true });
    const finalUrl = page.url().replace(APP, '');
    const redirected = finalUrl.split('?')[0] !== path.split('?')[0];
    console.log(
      `  [${viewport}] ${name.padEnd(24)} ${String(resp?.status() ?? '?').padEnd(4)}` +
        `${redirected ? ` -> ${finalUrl}` : ''}${problems.length ? `  (${problems.length} console issue)` : ''}`,
    );
    return { name, viewport, path, status: resp?.status() ?? null, finalUrl, redirected, problems };
  } catch (err) {
    console.log(`  [${viewport}] ${name.padEnd(24)} ERROR ${String(err).slice(0, 120)}`);
    return { name, viewport, path, error: String(err), problems };
  } finally {
    await page.close();
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const adminAuth = await login('admin');
  await sleep(1000);
  const custAuth = await login('customer');

  // Real ids for detail routes.
  const custOrders = await apiGet('/orders?take=5', custAuth.accessToken);
  const custOrderId = custOrders?.items?.[0]?.id ?? custOrders?.items?.[0]?._id ?? 'missing';
  const adminOrders = await apiGet('/admin/orders?take=5', adminAuth.accessToken);
  const adminOrderId = adminOrders?.items?.[0]?.id ?? adminOrders?.items?.[0]?._id ?? 'missing';

  // Best-effort: put an item in the customer cart so /checkout renders the real thing.
  try {
    const products = await apiGet('/products?take=1', null);
    const p = products?.items?.[0];
    if (p) {
      const variantSku =
        p.variants?.[0]?.sku ?? (await apiGet(`/products/${p.slug}`, null))?.variants?.[0]?.sku;
      await fetch(`${API}/cart/items`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${custAuth.accessToken}`,
        },
        body: JSON.stringify({ productSlug: p.slug, variantSku, quantity: 1 }),
      });
    }
  } catch {
    /* checkout will just show its empty state — still useful evidence */
  }

  const PUBLIC = [
    ['home', '/'],
    ['shop', '/shop'],
    ['shop-filtered', '/shop?category=gloves'],
    ['product-detail', '/product/tour-authentic-cabretta-leather-glove'],
    ['sign-in', '/sign-in'],
    ['sign-up', '/sign-up'],
    ['forgot-password', '/forgot-password'],
    ['reset-password', '/reset-password?token=demo-token'],
    ['verify-email', '/verify-email?token=demo-token'],
    ['cart', '/cart'],
    ['track', '/track'],
    ['blog-list', '/blog'],
    ['blog-post', '/blog/mental-game-staying-calm-under-tournament-pressure'],
    ['content-page-about', '/pages/about'],
    ['content-page-faq', '/pages/faq'],
    ['contact', '/contact'],
    ['newsletter-confirm', '/newsletter/confirm?token=demo-token'],
    ['newsletter-unsubscribe', '/newsletter/unsubscribe?token=demo-token'],
    ['styleguide', '/styleguide'],
    ['not-found', '/no-such-page-xyz'],
  ];

  const CUSTOMER = [
    ['account-profile', '/account/profile'],
    ['account-addresses', '/account/addresses'],
    ['account-orders', '/account/orders'],
    ['account-order-detail', `/account/orders/${custOrderId}`],
    ['account-wishlist', '/account/wishlist'],
    ['account-returns', '/account/returns'],
    ['account-return-new', '/account/returns/new'],
    ['account-payment-methods', '/account/payment-methods'],
    ['account-settings', '/account/settings'],
    ['checkout', '/checkout'],
    ['order-complete', `/checkout/complete/${custOrderId}`],
  ];

  const ADMIN = [
    ['admin-dashboard', '/admin/dashboard'],
    ['admin-categories', '/admin/categories'],
    ['admin-products', '/admin/products'],
    ['admin-inventory', '/admin/inventory'],
    ['admin-media', '/admin/media'],
    ['admin-orders', '/admin/orders'],
    ['admin-order-detail', `/admin/orders/${adminOrderId}`],
    ['admin-returns', '/admin/returns'],
    ['admin-reviews', '/admin/reviews'],
    ['admin-coupons', '/admin/coupons'],
    ['admin-gift-cards', '/admin/gift-cards'],
    ['admin-shipping', '/admin/shipping'],
    ['admin-tax', '/admin/tax'],
    ['admin-blog', '/admin/blog'],
    ['admin-pages', '/admin/pages'],
    ['admin-contact', '/admin/contact'],
    ['admin-newsletter', '/admin/newsletter'],
    ['admin-emails', '/admin/emails'],
    ['admin-users', '/admin/users'],
    ['admin-audit-log', '/admin/audit-log'],
  ];

  const browser = await chromium.launch();
  const results = [];

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    console.log(`\n=== ${vpName} (${vp.width}x${vp.height}) ===`);

    const anon = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    for (const [name, path] of PUBLIC) results.push(await capture(anon, vpName, name, path));
    await anon.close();

    const cust = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await cust.addInitScript((t) => {
      localStorage.setItem('auth.accessToken', t.a);
      localStorage.setItem('auth.refreshToken', t.r);
    }, { a: custAuth.accessToken, r: custAuth.refreshToken });
    for (const [name, path] of CUSTOMER) results.push(await capture(cust, vpName, name, path));
    await cust.close();

    const admin = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await admin.addInitScript((t) => {
      localStorage.setItem('auth.accessToken', t.a);
      localStorage.setItem('auth.refreshToken', t.r);
    }, { a: adminAuth.accessToken, r: adminAuth.refreshToken });
    for (const [name, path] of ADMIN) results.push(await capture(admin, vpName, name, path));
    await admin.close();
  }

  await browser.close();
  writeFileSync(join(OUT, 'capture-report.json'), JSON.stringify(results, null, 2));

  const redirects = results.filter((r) => r.redirected && !r.error);
  const errors = results.filter((r) => r.error);
  const consoleIssues = results.filter((r) => r.problems?.length);
  console.log(`\n\n=== SUMMARY ===`);
  console.log(`captured: ${results.length - errors.length}/${results.length}`);
  console.log(`redirected: ${redirects.length}`, redirects.map((r) => `${r.name}->${r.finalUrl}`));
  console.log(`errors: ${errors.length}`, errors.map((r) => r.name));
  console.log(`pages with console errors: ${[...new Set(consoleIssues.map((r) => r.name))].join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
