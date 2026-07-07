// Current Mood card quotes (Figma nodes 361:10287 "Very Happy", 311:6590
// "Very Sad", 311:7241 "Sad", 311:7570 "Neutral", 311:7900 "Happy") — each
// mood's first entry is the exact Figma-confirmed quote; the other 9 per
// mood are additional quotes written to match that mood's tone, giving up
// to 10 to rotate through per the request.
export const MOOD_QUOTES = {
  veryHappy: [
    "When your heart is full, share your light with the world.",
    "Let today's joy remind you how good life can feel.",
    "Celebrate this moment — you've earned every bit of it.",
    "Your happiness is contagious; let it spread today.",
    "Joy like this deserves to be savored, not rushed.",
    "Keep this feeling close; it will carry you far.",
    "Some days just shine brighter — today is one of them.",
    "Let this brightness remind you what's possible.",
    "Happiness this big is worth remembering on harder days.",
    "You're glowing — let the world see it.",
  ],
  happy: [
    "Happiness grows when it's shared with others.",
    "A good day is a gift — enjoy every bit of it.",
    "Small joys add up to a life well lived.",
    "Let today's good mood carry into tomorrow.",
    "Contentment is its own quiet kind of victory.",
    "You don't need a reason to feel good — just enjoy it.",
    "Hold onto this feeling; you deserve it.",
    "A light heart makes for a lighter day.",
    "This is what a good day feels like — remember it.",
    "Keep doing what makes you feel this way.",
  ],
  neutral: [
    "A calm mind can find opportunity in every moment.",
    "Not every day needs to be extraordinary to matter.",
    "Steady days build the foundation for great ones.",
    "There's peace in simply being okay today.",
    "Balance is its own kind of progress.",
    "A quiet day is still a day worth living.",
    "Sometimes neutral is exactly where you need to be.",
    "Stillness has its own quiet wisdom.",
    "An even keel can carry you just as far.",
    "Today doesn't have to be more than it is.",
  ],
  sad: [
    "One small positive thought can change your entire day.",
    "It's okay to not be okay today.",
    "Be gentle with yourself — healing isn't linear.",
    "This feeling will pass, even if it doesn't feel like it now.",
    "You don't have to carry this alone.",
    "Tomorrow is a new page — rest tonight.",
    "Even small steps forward still count.",
    "Your feelings are valid, and so is your strength.",
    "It's okay to ask for support when you need it.",
    "Better days are still ahead of you.",
  ],
  verySad: [
    "You are stronger than you think; the storm will pass.",
    "This pain is real, but so is your resilience.",
    "You don't have to face this alone — reach out.",
    "Even the darkest night ends with sunrise.",
    "It's okay to rest before you find your footing again.",
    "You've survived every hard day so far — that matters.",
    "Be patient with yourself; healing takes time.",
    "This moment is heavy, but it isn't forever.",
    "Reaching out is a sign of strength, not weakness.",
    "You are allowed to grieve, rest, and heal.",
  ],
};

// Deterministic (not random) so the same mood-log entry always shows the
// same quote on reload, while different entries/moods vary. `seed` is
// expected to be the mood log's `id`.
export function pickQuote(mood, seed) {
  const quotes = MOOD_QUOTES[mood];
  if (!quotes || quotes.length === 0) return "";
  const hash = String(seed)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return quotes[hash % quotes.length];
}
