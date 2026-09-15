/**
 * Seeds the customer-engagement surfaces that no other seed script covers:
 * contact messages, newsletter subscribers, blog comments, and returns.
 *
 * Unlike the other seeds, this one drives the REAL public HTTP API rather
 * than inserting documents directly — every record here is produced by the
 * same controller, DTO validation, command handler and outbox event a real
 * visitor would trigger. That makes it a live end-to-end check of those
 * four flows as well as a seed, and it guarantees the seeded rows carry
 * whatever derived state (moderation status, dedupe keys, audit entries)
 * the real write path attaches.
 *
 * Requires the API to be running (npm start) — it talks to API_URL,
 * default http://localhost:4000/api/v1.
 *
 * Run: npm run seed:engagement
 */
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const PASSWORD = 'Password123!';

// WRITE_THROTTLE is 5 requests per minute per IP, so ~13s between writes
// keeps the seed comfortably under it without a retry storm.
const WRITE_SPACING_MS = 13_000;
const THROTTLE_BACKOFF_MS = 62_000;
const MAX_THROTTLE_RETRIES = 2;

interface Counters {
  contact: number;
  newsletter: number;
  comments: number;
  returns: number;
  reviews: number;
}

const CONTACT_MESSAGES = [
  {
    name: 'Marcus Webb',
    email: 'marcus.webb@example.com',
    subject: 'Glove sizing between L and XL',
    message:
      "I'm between sizes on the Tour Authentic glove — my hand measures 8.5 inches. Would you recommend the L or the XL for a snug tour fit?",
  },
  {
    name: 'Priya Raman',
    email: 'priya.raman@example.com',
    subject: 'Do you ship rangefinders to Germany?',
    message:
      'Looking at the Bushnell Tour V6 Shift. Checkout shows an international option — can you confirm duties are not charged separately on arrival?',
  },
  {
    name: 'Tomás Herrera',
    email: 'tomas.herrera@example.com',
    subject: 'Wrong size delivered',
    message:
      'Order came through quickly but the polo is a medium and I ordered large. Happy to send it back, just need a returns label.',
  },
  {
    name: 'Grace Aboagye',
    email: 'grace.aboagye@example.com',
    subject: 'Bulk order for a club day',
    message:
      'We need roughly 40 sleeves of golf balls and 40 towels for a charity day in October. Is there a trade price at that volume?',
  },
  {
    name: 'Daniel Okafor',
    email: 'daniel.okafor@example.com',
    subject: 'Restock on the Juniors set?',
    message:
      "The juniors' set has been out of stock for a couple of weeks. Any idea when it's back? Buying for my son's birthday.",
  },
];

const NEWSLETTER_EMAILS = [
  'marcus.webb@example.com',
  'priya.raman@example.com',
  'grace.aboagye@example.com',
  'daniel.okafor@example.com',
  'ellie.fontaine@example.com',
  'noah.lindqvist@example.com',
  'aisha.bakr@example.com',
];

const COMMENTS = [
  {
    authorName: 'Marcus Webb',
    authorEmail: 'marcus.webb@example.com',
    body: 'The bit about swing shape changing under pressure is exactly my problem. Tried the tempo drill this weekend and hit 9 of 14 fairways, up from about 5.',
  },
  {
    authorName: 'Priya Raman',
    authorEmail: 'priya.raman@example.com',
    body: 'Great read. Would love a follow-up on how this applies to the short game — I lose far more shots inside 100 yards than off the tee.',
  },
  {
    authorName: 'Tomás Herrera',
    authorEmail: 'tomas.herrera@example.com',
    body: 'Disagree slightly on the driver loft advice — I went lower and lost carry. Worth getting properly fitted before changing anything.',
  },
  {
    authorName: 'Grace Aboagye',
    authorEmail: 'grace.aboagye@example.com',
    body: 'Sent this to my playing partner who is convinced distance is all about the gym. Numbers here are a good reality check.',
  },
];

const PENDING_REVIEWS = [
  {
    rating: 5,
    title: 'Grips like it is part of your hand',
    body: 'Third season on cabretta and this is the best of them. Broke in after two rounds and has not gone slick in the heat.',
  },
  {
    rating: 4,
    title: 'Great, one caveat',
    body: 'Fit and feel are excellent. Half a size small though — I normally take a medium and the large is the better fit here.',
  },
  {
    rating: 2,
    title: 'Stitching let go early',
    body: 'Looked and felt great out of the box but the seam by the thumb opened up inside a month of twice-weekly play.',
  },
  {
    rating: 5,
    title: 'Exactly what I wanted',
    body: 'Arrived two days early, packaging was spotless, and it performs as described. No notes.',
  },
];

const RETURN_REASONS = [
  'Ordered the wrong size — need a large instead.',
  'Arrived with a scuff on the sole, not as described.',
  'Changed my mind after a fitting; found a better match.',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POSTs, and backs off when the app's own rate limiter says to.
 *
 * Public writes are capped by WRITE_THROTTLE (5 per minute per IP), so a
 * seed that fires as fast as Node can loop trips the limiter after five
 * rows and reports failures that are really self-inflicted. Pace the
 * requests, and retry a 429 once the window has rolled over.
 */
async function post(path: string, body: unknown, token?: string, attempt = 0): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && attempt < MAX_THROTTLE_RETRIES) {
    const waitMs = Number(res.headers.get('retry-after') ?? 0) * 1000 || THROTTLE_BACKOFF_MS;
    console.log(`    … rate limited, waiting ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
    return post(path, body, token, attempt + 1);
  }

  await sleep(WRITE_SPACING_MS);
  return res;
}

async function get<T>(path: string, token?: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.ok ? ((await res.json()) as T) : null;
}

/** Seeded customers, in fallback order — see loginAsAnyCustomer. */
const REVIEWER_EMAILS = [
  'james.whitaker@example.com',
  'sofia.marchetti@example.com',
  'liam.oconnell@example.com',
  'hannah.kim@example.com',
  'charlotte.bennett@example.com',
];

async function loginAsAnyCustomer(emails: string[]): Promise<string | null> {
  for (const email of emails) {
    const token = await login(email);
    if (token) return token;
  }
  return null;
}

async function login(email: string): Promise<string | null> {
  const res = await post('/auth/login', { email, password: PASSWORD });
  if (!res.ok) {
    console.warn(`  ! login failed for ${email} (${res.status})`);
    return null;
  }
  return (await res.json()).accessToken as string;
}

/** The API is the source of truth for "is this running" — fail fast and loud. */
async function assertApiUp(): Promise<void> {
  try {
    const res = await fetch(`${API}/categories`);
    if (!res.ok) throw new Error(`categories returned ${res.status}`);
  } catch (error) {
    throw new Error(
      `Cannot reach the API at ${API} — start it with \`npm start\` first. (${String(error)})`,
    );
  }
}

async function seedContact(counters: Counters): Promise<void> {
  console.log('\nContact messages');
  for (const msg of CONTACT_MESSAGES) {
    const res = await post('/contact', msg);
    if (res.ok) {
      counters.contact += 1;
      console.log(`  + ${msg.subject}`);
    } else {
      console.warn(`  ! ${msg.subject} -> ${res.status} ${await res.text()}`);
    }
  }
}

async function seedNewsletter(counters: Counters): Promise<void> {
  console.log('\nNewsletter subscribers');
  for (const email of NEWSLETTER_EMAILS) {
    const res = await post('/newsletter/subscribe', { email });
    // subscribe() is deliberately silent on "already subscribed" — a 2xx
    // here means "accepted", not necessarily "new row".
    if (res.ok) {
      counters.newsletter += 1;
      console.log(`  + ${email}`);
    } else {
      console.warn(`  ! ${email} -> ${res.status}`);
    }
  }
}

async function seedComments(counters: Counters): Promise<void> {
  console.log('\nBlog comments');
  const posts = await get<{ items: { id: string; slug: string; title: string }[] }>(
    '/blog/posts?take=3',
  );
  if (!posts?.items?.length) {
    console.warn('  ! no published posts — run `npm run seed:content` first');
    return;
  }
  for (const [index, comment] of COMMENTS.entries()) {
    const post_ = posts.items[index % posts.items.length];
    const res = await post(`/blog/posts/${post_.id}/comments`, comment);
    if (res.ok) {
      counters.comments += 1;
      console.log(`  + ${comment.authorName} on "${post_.title}"`);
    } else {
      console.warn(`  ! ${comment.authorName} -> ${res.status} ${await res.text()}`);
    }
  }
}

/**
 * Returns need a real, delivered order owned by the customer requesting
 * them, so this walks the admin order list to find eligible orders and
 * then logs in AS that customer to file the request through the same
 * endpoint the account area uses.
 */
async function seedReturns(counters: Counters, adminToken: string): Promise<void> {
  console.log('\nReturns');
  const orders = await get<{ items: OrderRow[] }>('/admin/orders?take=50', adminToken);
  const eligible = (orders?.items ?? []).filter((o) =>
    ['delivered', 'shipped', 'fulfilled'].includes(o.status),
  );
  if (eligible.length === 0) {
    console.warn('  ! no delivered/shipped/fulfilled orders — run `npm run seed:orders` first');
    return;
  }

  let filed = 0;
  const emailByUserId = new Map<string, string>();
  const tokenByEmail = new Map<string, string>();

  for (const order of eligible) {
    if (filed >= RETURN_REASONS.length) break;
    const full = await get<OrderRow>(`/admin/orders/${order.id}`, adminToken);
    const item = full?.items?.[0];
    // An admin order carries userId, never the customer's email — resolve
    // it through the admin user endpoint (and cache it: the seeded orders
    // cluster onto a handful of customers, and /auth/login is throttled at
    // 5 attempts per 15 minutes).
    if (!item || !full?.userId) continue;
    let email = emailByUserId.get(full.userId);
    if (!email) {
      const user = await get<{ email: string }>(`/admin/users/${full.userId}`, adminToken);
      if (!user?.email) continue;
      email = user.email;
      emailByUserId.set(full.userId, email);
    }

    let token = tokenByEmail.get(email);
    if (!token) {
      const fresh = await login(email);
      if (!fresh) continue;
      token = fresh;
      tokenByEmail.set(email, token);
    }

    // OrderItem is an embedded subdocument without baseSchemaOptions, so it
    // serialises `_id`, not `id` — see the account-area DTOs for the same trap.
    const orderItemId = item._id ?? item.id;
    const res = await post(
      '/returns',
      {
        orderId: order.id,
        items: [{ orderItemId, quantity: 1, reason: RETURN_REASONS[filed] }],
      },
      token,
    );
    if (res.ok) {
      counters.returns += 1;
      filed += 1;
      console.log(`  + return on order ${order.orderNumber ?? order.id} for ${email}`);
    } else {
      console.warn(`  ! order ${order.id} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
    }
  }
}

/**
 * Reviews submitted through the public endpoint land as `pending`, which
 * is exactly what the admin moderation queue filters to by default — the
 * seeded catalogue reviews are all pre-approved, so without these the
 * queue is empty and the approve/reject flow has nothing to act on.
 */
async function seedReviews(counters: Counters, adminToken: string): Promise<void> {
  console.log('\nPending reviews');
  const products = await get<{ items: { id: string; name: string }[] }>(
    '/admin/products?take=4',
    adminToken,
  );
  if (!products?.items?.length) {
    console.warn('  ! no products — run `npm run seed:catalog` first');
    return;
  }

  // One customer files all of them: /auth/login is throttled at 5 attempts
  // per 15 minutes, so a login per review would trip the limiter. Falls
  // through a few seeded customers because a re-run inside that window
  // will find the first one already rate-limited.
  const token = await loginAsAnyCustomer(REVIEWER_EMAILS);
  if (!token) {
    console.warn('  ! could not sign in as any reviewing customer (rate limited?)');
    return;
  }

  for (const [index, review] of PENDING_REVIEWS.entries()) {
    const product = products.items[index % products.items.length];
    const res = await post('/reviews', { productId: product.id, ...review }, token);
    if (res.ok) {
      counters.reviews += 1;
      console.log(`  + ${review.rating}★ on "${product.name}"`);
    } else {
      console.warn(`  ! ${product.name} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
    }
  }
}

interface OrderRow {
  id: string;
  status: string;
  orderNumber?: string;
  userId?: string;
  items?: { _id?: string; id?: string }[];
}

async function main(): Promise<void> {
  await assertApiUp();
  console.log(`Seeding engagement data via ${API}`);

  const counters: Counters = { contact: 0, newsletter: 0, comments: 0, returns: 0, reviews: 0 };

  await seedContact(counters);
  await seedNewsletter(counters);
  await seedComments(counters);

  const adminToken = await login('admin@3legantgolf.com');
  if (adminToken) {
    await seedReturns(counters, adminToken);
    await seedReviews(counters, adminToken);
  } else {
    console.warn('\nReturns skipped — could not sign in as admin.');
  }

  console.log(
    `\nDone: ${counters.contact} contact messages, ${counters.newsletter} newsletter signups, ` +
      `${counters.comments} comments, ${counters.returns} returns, ${counters.reviews} pending reviews.`,
  );
  console.log(
    'Comments, reviews and returns land in their pending/requested state — moderate them in the admin panel.',
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
