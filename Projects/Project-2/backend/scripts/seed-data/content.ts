// Seed data for scripts/seed-content.ts. Kept separate from the script
// itself, same split as seed-data/categories.ts + seed-data/products.ts.

export interface PostCategorySeed {
  name: string;
  slug: string;
}

export const POST_CATEGORY_SEEDS: PostCategorySeed[] = [
  { name: 'Course Guides', slug: 'course-guides' },
  { name: 'Gear & Reviews', slug: 'gear-reviews' },
  { name: 'Technique', slug: 'technique' },
  { name: 'Tournament Coverage', slug: 'tournament-coverage' },
  { name: 'Travel & Lifestyle', slug: 'travel-lifestyle' },
];

// Tag has no slug field (tag.schema.ts) — matched by name at seed time.
export const TAG_SEEDS: string[] = [
  'putting',
  'driving',
  'beginners',
  'equipment-care',
  'pro-tips',
  'mental-game',
  'junior-golf',
  'travel',
];

export interface PostSeed {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  categorySlug: string;
  tags: string[];
  imageQuery: string;
  /** Days before "now" this post went live — staggers publishedAt so the list isn't all one timestamp. */
  daysAgo: number;
}

export const POST_SEEDS: PostSeed[] = [
  {
    title: 'Reading Greens Like a Pro',
    slug: 'reading-greens-like-a-pro',
    excerpt:
      "Most three-putts start before the stroke — they start with a bad read. Here's how to actually see the break.",
    body: `
      <p>Every green tells you where the ball wants to go before you ever pull the putter back. The trouble is most amateurs read a green from one spot, one time, and commit — which is exactly how a subtle two-percent slope turns into a three-putt.</p>
      <h2>Walk it before you trust it</h2>
      <p>Professionals rarely read a putt from directly behind the ball alone. Walk the line from the low side as well — slope that's nearly invisible from behind the ball becomes obvious from the side, especially on anything inside fifteen feet where the eye tends to flatten out subtle breaks.</p>
      <h2>Let gravity, not hope, pick the line</h2>
      <p>Water always finds the same way down a green that your ball will. If there's a sprinkler head, a drain, or a low corner of the green nearby, that's your tell — greens are built to shed water somewhere, and "somewhere" is rarely dead flat.</p>
      <ul>
        <li>Read the last three feet twice — that's where a putt is slowest and most affected by break.</li>
        <li>Trust the first read. A second guess is usually fear, not new information.</li>
        <li>Speed controls break more than line does — a firm putt holds its line; a dying putt falls hard toward the low side.</li>
      </ul>
      <p>None of this replaces feel built on the practice green. But a better read gives your stroke an honest chance — and most three-putts were never a stroke problem to begin with.</p>
    `,
    categorySlug: 'technique',
    tags: ['putting', 'pro-tips'],
    imageQuery: 'golfer reading putting green break',
    daysAgo: 6,
  },
  {
    title: 'The Timeless Classics on the Green',
    slug: 'the-timeless-classics-on-the-green',
    excerpt:
      'Before analytics and agronomy science, a handful of architects shaped how golf courses are still built today. A short tour of the ideas that stuck.',
    body: `
      <p>Golf course architecture is one of the few sports disciplines where a hundred-year-old design still plays as a genuine test today. That's not an accident — the best early architects were solving a problem that hasn't changed: how to make a hole demand thought, not just distance.</p>
      <h2>The ground game came first</h2>
      <p>Early links courses in Scotland weren't designed at all in the modern sense — they were found, on land where sheep grazing and coastal wind had already carved natural humps, hollows, and firm turf. Strategy grew out of terrain rather than being drawn onto a blank canvas, which is why the oldest courses still reward a shot played along the ground as much as one hit high and soft.</p>
      <h2>Strategic, not penal</h2>
      <p>The architects whose work is still studied — the ones behind the era's most enduring designs — mostly agreed on one principle: a hazard should present a choice, not just a punishment. A bunker placed to punish every mediocre shot equally teaches nothing. A bunker placed to reward a bold line off the tee, while leaving a safer route open, makes the golfer think on every shot rather than just swing.</p>
      <p>That idea — risk offered, not risk forced — is still the backbone of modern course design, right down to the "risk-reward" par 5s that decide tournaments today.</p>
    `,
    categorySlug: 'course-guides',
    tags: ['travel'],
    imageQuery: 'aerial view golf course fairway coastline',
    daysAgo: 14,
  },
  {
    title: 'Inside the Ryder Cup Gallery',
    slug: 'inside-the-ryder-cup-gallery',
    excerpt:
      "TV doesn't capture what it actually feels like to stand three rows back at a Ryder Cup. Here's what changes when you're there in person.",
    body: `
      <p>A regular PGA Tour gallery is polite. A Ryder Cup gallery is something else entirely — closer to a stadium crowd that happens to be arranged around a fairway instead of a pitch.</p>
      <h2>The noise arrives before the players do</h2>
      <p>You hear a Ryder Cup hole before you see it. A roar rolls down the fairway from three holes away, and by the time it reaches you, you already know something happened — a putt dropped, an approach found the pin, a match flipped. Watching it build player by player, group by group, is a different experience than any highlight reel can compress.</p>
      <h2>Match play changes everything about how you watch</h2>
      <p>Stroke play rewards patience — a bad hole is recoverable over 72 holes. Match play has no such mercy. Every single hole is its own contest, which means the gallery's mood can flip from silence to eruption in the time it takes one putt to drop. Standing in that gallery, you feel the match's momentum the way the players do — not through a leaderboard, but through the crowd around you reacting in real time.</p>
      <p>If it's ever within reach, go once. No broadcast angle replicates standing in the exact spot where a stadium's worth of golf fans just watched history swing.</p>
    `,
    categorySlug: 'tournament-coverage',
    tags: ['pro-tips'],
    imageQuery: 'golf tournament crowd gallery fairway',
    daysAgo: 3,
  },
  {
    title: 'How to Choose Your First Set of Golf Clubs',
    slug: 'how-to-choose-your-first-set-of-golf-clubs',
    excerpt:
      "A full bag of premium irons is the wrong first purchase for almost every new golfer. Here's what actually matters starting out.",
    body: `
      <p>The golf industry would love to sell a beginner a full fitted bag on day one. Almost none of that spend is well placed — a new golfer's swing changes too fast in the first year for a precise fitting to hold its value, and half the bag won't get used while the fundamentals are still forming.</p>
      <h2>Start with a compact set</h2>
      <p>A combo set — driver, a couple of hybrids in place of hard-to-hit long irons, mid-to-short irons, a wedge, and a putter — covers every distance a beginner needs without the intimidation of a full 14-club bag. Hybrids in particular are far more forgiving than long irons on off-center strikes, which is most strikes for the first several months.</p>
      <h2>Fit for now, not for someday</h2>
      <p>Shaft flex and length should match the swing speed and height you have today, not the one you're hoping to build toward. A shaft that's too stiff for a developing swing speed kills distance and feel — the opposite of what a beginner needs for feedback and confidence.</p>
      <ul>
        <li>Get a proper length/lie fitting even on an entry set — it's usually free at a proper fitter and costs nothing extra.</li>
        <li>Graphite shafts in the irons, not just the driver, help most beginners generate speed with less effort.</li>
        <li>Buy the upgraded, fitted set once your handicap stabilizes — usually a year or two in, not before.</li>
      </ul>
    `,
    categorySlug: 'gear-reviews',
    tags: ['beginners', 'equipment-care'],
    imageQuery: 'golf clubs set leaning bag grass',
    daysAgo: 21,
  },
  {
    title: 'Packing for a Golf Trip: The Carry-On Checklist',
    slug: 'packing-for-a-golf-trip-the-carry-on-checklist',
    excerpt:
      "Checked golf bags get lost more often than regular luggage. Here's what to carry on so a delayed bag doesn't end your trip before it starts.",
    body: `
      <p>A golf trip is one of the few kinds of travel where checked luggage delays can genuinely ruin the point of the trip — you can buy a spare shirt at any store, but you can't buy your own swing weight and grip feel off a pro shop rack an hour before your tee time.</p>
      <h2>What belongs in the carry-on, not the travel bag</h2>
      <ul>
        <li><strong>Your glove and a spare</strong> — leather gloves are cheap to replace but painful to play without if your bag is delayed a day.</li>
        <li><strong>A rangefinder or GPS device</strong> — small, easy to carry on, and expensive/awkward to rebuy at a destination pro shop.</li>
        <li><strong>Soft spikes and a spike wrench</strong> — some resort courses require specific spike types you may not own yet.</li>
        <li><strong>A folding umbrella and a rain glove</strong> — weather doesn't check your itinerary, and destination pro shops sell out of both fast during a wet week.</li>
      </ul>
      <h2>Protect the clubs that do get checked</h2>
      <p>A hard travel case is worth the extra bag fee on any trip longer than a long weekend — soft travel covers protect against scuffs, not against baggage handlers stacking heavier bags on top. Loosen the driver head cover slightly and pad the shaft tips; that's where most in-transit cracks happen.</p>
    `,
    categorySlug: 'travel-lifestyle',
    tags: ['travel', 'equipment-care'],
    imageQuery: 'golf travel bag airport luggage',
    daysAgo: 9,
  },
  {
    title: 'Mental Game: Staying Calm Under Tournament Pressure',
    slug: 'mental-game-staying-calm-under-tournament-pressure',
    excerpt:
      "The swing that works on the range falls apart under pressure for one reason: the mind changed, not the mechanics. Here's how to keep both in sync.",
    body: `
      <p>Pressure doesn't break a golf swing directly — it changes tempo, and tempo is where most pressure shots actually go wrong. A rushed backswing under nerves is almost always the real cause behind a shot that looked, on video, like a technical mistake.</p>
      <h2>Give the mind one job at a time</h2>
      <p>Trying to think about grip pressure, alignment, tempo, and the read all in the seconds before a pressure shot overloads exactly the kind of quiet focus that pressure shots need. One pre-shot swing thought — a single word, like "smooth" or "finish" — leaves room for the practiced swing to actually run instead of being second-guessed mid-motion.</p>
      <h2>Breathe on a count, not just "deeply"</h2>
      <p>A slow four-count exhale before addressing the ball measurably lowers heart rate compared to a vague "take a deep breath," because it gives the nervous system a concrete rhythm to entrain to rather than an instruction to interpret under stress.</p>
      <h2>Play the shot in front of you, not the leaderboard</h2>
      <p>The moment a golfer starts playing the scoreboard instead of the shot, tempo speeds up without the golfer noticing. Committing fully to one shot at a time isn't a cliché — it's the only mental trick that actually removes the leaderboard from the golfer's nervous system for the four seconds a swing takes.</p>
    `,
    categorySlug: 'technique',
    tags: ['mental-game', 'pro-tips'],
    imageQuery: 'golfer focused tee box deep breath',
    daysAgo: 1,
  },
  {
    title: 'Junior Golf: Building a Love for the Game Early',
    slug: 'junior-golf-building-a-love-for-the-game-early',
    excerpt:
      "Junior golf goes wrong the moment it starts looking like adult golf, scaled down. What actually keeps kids coming back to the course.",
    body: `
      <p>The single biggest mistake in introducing a child to golf is starting them on a full-length course with adult expectations of pace, scoring, and etiquette. Golf's learning curve is steep enough for adults who chose to be there — for a seven-year-old, an 18-hole round with full rules is a fast way to end the experiment before it starts.</p>
      <h2>Shrink the game before you teach the game</h2>
      <p>Shorter tees, fewer holes, and even a smaller, lighter ball for the youngest beginners keep success rates high enough to stay fun. A junior who can actually reach the green in a realistic number of shots stays engaged; one who's hitting their eighth shot on a 380-yard par 4 is not building a love for the game, they're building a reason to quit.</p>
      <h2>Let the short game come first</h2>
      <p>Putting and chipping require far less physical strength than a full swing, so a junior can genuinely compete with an adult at them almost immediately. Starting there builds real confidence and real skill before the long game — which takes years of strength and coordination to develop — becomes the focus.</p>
      <ul>
        <li>Keep early rounds to 6 or 9 holes, not 18.</li>
        <li>Celebrate a good shot, not a good score — juniors internalize enjoyment before they internalize scorekeeping.</li>
        <li>Let them choose their own tee, even if it's closer than "official" junior tees suggest.</li>
      </ul>
    `,
    categorySlug: 'travel-lifestyle',
    tags: ['junior-golf', 'beginners'],
    imageQuery: 'child swinging golf club practice',
    daysAgo: 18,
  },
  {
    title: 'Driving for Distance Without Losing the Fairway',
    slug: 'driving-for-distance-without-losing-the-fairway',
    excerpt:
      'Every extra yard off the tee that ends up in the trees is a wasted yard. A few real changes that add distance without sacrificing accuracy.',
    body: `
      <p>Distance and accuracy are usually framed as a trade-off, but most golfers lose fairways not because they're swinging too hard, but because their swing changes shape when they try to swing hard — an entirely fixable problem.</p>
      <h2>Speed comes from sequence, not effort</h2>
      <p>The longest, straightest drivers in the world generate speed through hip-then-shoulder-then-arm sequencing, not through gripping down and swinging harder with the arms. Trying to "hit it harder" with the same faulty sequence just amplifies whatever fault was already there — including the one causing the slice or hook to begin with.</p>
      <h2>Tee height matters more than most golfers think</h2>
      <p>Teeing the ball so roughly half the ball sits above the driver's crown at address promotes the slight upward angle of attack that modern low-spin drivers are actually designed around. Too low a tee height with a driver built for an ascending strike costs both distance and the forgiveness the club was engineered to provide.</p>
      <h2>Practice with a target, not just a direction</h2>
      <p>"Hit it down the range" builds bad habits fast. Picking an actual target — even a specific tree or yardage marker — on every single range drive trains the same commitment and alignment discipline the course actually demands, so the swing that shows up on the tee on Saturday isn't meeting a real target for the first time all week.</p>
    `,
    categorySlug: 'technique',
    tags: ['driving', 'pro-tips'],
    imageQuery: 'golfer driving tee shot fairway',
    daysAgo: 11,
  },
];

export interface PageSeed {
  title: string;
  slug: string;
  body: string;
  seoTitle?: string;
  seoDescription?: string;
}

export const PAGE_SEEDS: PageSeed[] = [
  {
    title: 'About Us',
    slug: 'about',
    seoDescription: 'The story behind 3legant Golf and what we stand for.',
    body: `
      <h2>More than just a game</h2>
      <p>3legant Golf started from a simple frustration: golf gear either came from big-box stores that treated it like generic sporting equipment, or from boutique pro shops priced for a very different budget. We built 3legant Golf to sit between the two — real, carefully chosen equipment and apparel, sold by people who actually play.</p>
      <h2>What we carry</h2>
      <p>Every product on this site is chosen for a reason, not just to fill a category page. We test clubs and gear on real courses before they go on the site, and we're honest in our product descriptions about who a piece of equipment is actually for — a beginner's first set and a low-handicapper's next driver are different products, not the same driver marketed two ways.</p>
      <h2>Our promise</h2>
      <p>Free returns within 30 days, transparent shipping timelines, and support from people who can actually answer a golf-specific question — not a script. That's the whole promise, and it's the same one whether you're buying your first putter or your fifth driver.</p>
    `,
  },
  {
    title: 'Shipping Policy',
    slug: 'shipping',
    seoDescription: 'Shipping zones, timelines, and rates for 3legant Golf orders.',
    body: `
      <h2>Where we ship</h2>
      <p>We currently ship to the United States, Canada, the United Kingdom, Australia, Germany, France, and Japan. Support for additional countries is on the way — if yours isn't listed yet, reach out and we'll let you know when it lands.</p>
      <h2>Processing time</h2>
      <p>Orders are processed within 1–2 business days. You'll receive a shipping confirmation email with tracking information as soon as your order leaves our warehouse.</p>
      <h2>Delivery estimates</h2>
      <ul>
        <li><strong>Standard shipping:</strong> 4–7 business days (domestic), 7–14 business days (international)</li>
        <li><strong>Express shipping:</strong> 2–3 business days (domestic), 4–7 business days (international)</li>
      </ul>
      <p>Delivery estimates begin from the date of shipment, not the date of order, and can vary with customs processing on international orders.</p>
      <h2>Shipping costs</h2>
      <p>Exact shipping rates are calculated at checkout based on your address, order weight, and selected speed — you'll always see the final cost before paying, never as a surprise afterward.</p>
    `,
  },
  {
    title: 'Returns & Refunds',
    slug: 'returns',
    seoDescription: 'How to request a return, our eligibility window, and refund timelines.',
    body: `
      <h2>30-day return window</h2>
      <p>If something isn't right, you can request a return within 30 days of delivery. Items must be unused, in their original condition, and in original packaging where applicable.</p>
      <h2>How to request a return</h2>
      <p>Sign in and open the order from your <a href="/account/orders">order history</a>, then choose "Request a return" and tell us which items and why. We review most requests within one business day.</p>
      <h2>What's eligible</h2>
      <ul>
        <li>Apparel and accessories in original, unworn condition with tags attached</li>
        <li>Clubs and equipment showing no signs of use beyond inspection</li>
        <li>Any item that arrived damaged or not as described — always eligible, no exceptions</li>
      </ul>
      <p>Gift cards and personalized/custom-fitted equipment are final sale and not eligible for return.</p>
      <h2>Refund timeline</h2>
      <p>Once your return is received and inspected, refunds are issued to your original payment method within 5–7 business days. You'll get an email at each step — request received, return approved, refund issued.</p>
    `,
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy',
    seoDescription: 'How 3legant Golf collects, uses, and protects your data.',
    body: `
      <h2>What we collect</h2>
      <p>We collect the information you give us directly — your name, email, shipping address, and order history — plus basic usage data (pages viewed, device type) to keep the site working well and secure.</p>
      <h2>How we use it</h2>
      <p>Your data is used to process orders, provide customer support, send order and shipping updates, and — only with your opt-in — occasional marketing emails about new products and promotions. You can opt out of marketing at any time from your <a href="/account/settings">account settings</a>.</p>
      <h2>What we never do</h2>
      <p>We never sell your personal data to third parties. Payment details are handled entirely by our payment processor and never stored on our own servers in a readable form.</p>
      <h2>Your rights</h2>
      <p>You can request a full export of your data or request account deletion at any time from your account settings. Deletion anonymizes your account; your order history is retained in de-identified form for accounting and fraud-prevention purposes, as required by law.</p>
    `,
  },
  {
    title: 'Terms of Service',
    slug: 'terms',
    seoDescription: 'The terms that govern using 3legant Golf and placing an order.',
    body: `
      <h2>Using this site</h2>
      <p>By using 3legant Golf, you agree to provide accurate information when creating an account or placing an order, and to use the site only for its intended purpose — browsing and purchasing golf equipment and apparel.</p>
      <h2>Orders and pricing</h2>
      <p>All prices are listed in US dollars unless otherwise noted at checkout. We reserve the right to correct pricing errors and to cancel and refund an order affected by one before it ships.</p>
      <h2>Product information</h2>
      <p>We work to keep product descriptions, images, and pricing accurate and up to date. Occasional errors can happen — if a listing is materially wrong, we'll contact you before fulfilling the order rather than shipping something different from what you ordered.</p>
      <h2>Account responsibility</h2>
      <p>You're responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Contact support immediately if you suspect unauthorized access.</p>
    `,
  },
  {
    title: 'FAQs',
    slug: 'faq',
    seoDescription: 'Answers to the questions we get asked most often.',
    body: `
      <h2>Ordering</h2>
      <p><strong>Do I need an account to order?</strong> Yes — a free account keeps your order history, saved addresses, and returns in one place, and takes under a minute to set up at checkout.</p>
      <p><strong>Can I change or cancel an order after placing it?</strong> Contact us as soon as possible after ordering. Once an order has shipped, it can no longer be changed or cancelled — you're welcome to request a return instead.</p>
      <h2>Shipping</h2>
      <p><strong>How do I track my order?</strong> You'll receive a tracking link by email once your order ships, and you can also view tracking from your <a href="/account/orders">order history</a> at any time.</p>
      <p><strong>Do you ship internationally?</strong> Yes, to the countries listed on our <a href="/pages/shipping">shipping policy</a> page, with more on the way.</p>
      <h2>Returns</h2>
      <p><strong>How long do I have to return something?</strong> 30 days from delivery — see our full <a href="/pages/returns">returns policy</a> for eligibility details.</p>
      <p><strong>How long does a refund take?</strong> 5–7 business days after we receive and inspect the returned item.</p>
      <h2>Products</h2>
      <p><strong>I'm new to golf — where should I start?</strong> Take a look at our <a href="/blog">journal</a> for beginner guides, or reach out through our <a href="/contact">contact form</a> and we'll point you toward the right gear for your game.</p>
    `,
  },
];
