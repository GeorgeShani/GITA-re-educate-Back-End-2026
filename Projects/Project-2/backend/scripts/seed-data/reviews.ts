// Rating-tiered templates a generator picks from and lightly varies —
// writing hundreds of individual reviews by hand isn't practical, but a
// single generic "Great product!" repeated verbatim reads as obviously
// fake. Grouped by star rating so the generated set stays internally
// consistent (a 5-star review never sounds like a complaint).
export interface ReviewTemplate {
  title: string;
  body: string;
}

export const REVIEW_TEMPLATES: Record<number, ReviewTemplate[]> = {
  5: [
    {
      title: 'Exactly what I needed',
      body: 'Bought this before a weekend trip and it performed better than I expected. Build quality feels genuinely premium, not just marketed that way. Already recommended it to two people in my group.',
    },
    {
      title: 'Worth every penny',
      body: 'Was on the fence about the price but after using it for a few rounds I get it. Noticeably better than the budget option I had before. No regrets.',
    },
    {
      title: 'Exceeded expectations',
      body: "Didn't expect to be this impressed. Fit and finish are excellent, and it's held up well through some rough weather rounds already.",
    },
    {
      title: 'My new go-to',
      body: "This replaced what I'd been using for years and honestly it's just better in every way. Comfortable, reliable, does exactly what it says.",
    },
    {
      title: 'Couldn’t be happier',
      body: "Ordered on a whim and it turned out to be one of the better purchases I've made for my bag this season. Highly recommend.",
    },
  ],
  4: [
    {
      title: 'Really solid, one small gripe',
      body: "Does what it's supposed to and the quality is there. Only minor complaint is it took a round or two to get used to, but no real issues otherwise.",
    },
    {
      title: 'Good value',
      body: 'Not the flashiest option out there but it gets the job done reliably. Would buy again, though I wish the color options were a bit better.',
    },
    {
      title: 'Happy with it',
      body: 'A step up from what I had before. Nothing to complain about really, just not quite life-changing enough for 5 stars.',
    },
    {
      title: 'Recommend with minor caveats',
      body: 'Works well and feels durable. Sizing ran slightly different than I expected so double check the chart, but otherwise a good buy.',
    },
  ],
  3: [
    {
      title: 'It’s fine',
      body: "Does the basic job but nothing about it stands out. Not bad for the price, just not something I'd rave about either.",
    },
    {
      title: 'Middle of the road',
      body: 'Neither impressed nor disappointed. Works as described, build quality is average for the category.',
    },
    {
      title: 'Decent starter option',
      body: "Good if you're just getting into the game and don't want to spend a lot yet. I'll probably upgrade eventually.",
    },
  ],
  2: [
    {
      title: 'Expected more for the price',
      body: 'Not terrible but not great either. Feels like it could be built a bit better given what it costs.',
    },
    {
      title: 'A bit disappointing',
      body: "Works, but I've had better experiences with similar products at this price point. Might return it if a better option comes along.",
    },
  ],
  1: [
    {
      title: 'Did not work out for me',
      body: 'Had issues with this almost immediately. Might just be bad luck with this particular unit, but I expected better quality control.',
    },
  ],
};

/** Rough real-world distribution — mostly positive, a genuine long tail, not a suspiciously even spread. */
export const RATING_WEIGHTS: [number, number][] = [
  [5, 45],
  [4, 30],
  [3, 15],
  [2, 7],
  [1, 3],
];
