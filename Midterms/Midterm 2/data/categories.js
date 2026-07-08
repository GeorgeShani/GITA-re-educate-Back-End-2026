export const categories = [
  "Food & Dining",
  "Groceries",
  "Transportation",
  "Housing",
  "Utilities",
  "Healthcare",
  "Shopping",
  "Entertainment",
  "Education",
  "Work",
  "Subscriptions",
  "Travel",
  "Fitness",
  "Personal Care",
  "Gifts & Donations",
  "Pets",
  "Miscellaneous",
];

const palette = [
  "#277C78", // green
  "#F2CDAC", // yellow
  "#82C9D7", // cyan
  "#626070", // navy
  "#826CB0", // purple
  "#C94736", // red
  "#3F82B2", // blue
  "#93674F", // brown
  "#934F6F", // magenta
  "#597C7C", // turquoise
  "#7F9161", // army green
  "#CAB361", // gold
  "#BE6C49", // orange
  "#97A0AC", // navy grey
];

// Stable category -> color map, keyed by the category's index.
export const categoryColors = Object.fromEntries(
  categories.map((category, index) => [category, palette[index % palette.length]])
);

// Fallback used for unknown / legacy categories.
export function colorFor(category) {
  return categoryColors[category] || "#98908B"; // beige-500
}
