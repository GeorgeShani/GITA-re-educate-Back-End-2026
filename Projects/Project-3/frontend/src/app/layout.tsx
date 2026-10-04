import type { Metadata } from "next";
import { Archivo, EB_Garamond, Martian_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// One family, three voices through its width axis: condensed for stamps, normal for text, expanded for display.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

// The manual's text face: a Garamond revival, used for long-form marketing and docs copy only.
const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  display: "swap",
});

const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Gridline", template: "%s · Gridline" },
  description:
    "Where a company's spreadsheets live: checked on arrival, scanned for personal data, cleaned, compared row by row, open to your questions, permissioned per person, and billed by seat and volume.",
};

// Sets the theme before the first paint so a dark visitor never sees a flash of light. It is emitted as HTML inside a hidden
// element, like the contract below: the browser runs it while parsing the page, and React never creates a <script> of its
// own, which it warns about whenever it re-renders the layout on the client (a not-found page, for one).
const THEME_SCRIPT = `<script>(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.style.colorScheme=d?"dark":"light"}catch(e){}})()</script>`;

// The direction contract is rendered as the first child of <body> (an HTML comment), so it survives the production build.
const DIRECTION_CONTRACT = `
THESIS: Gridline is the company's reference manual: every division a hue-edged leaf, every file a leaf that has been checked. Refuses the gradient-hero, floating-screenshot, three-card SaaS template.
OWN-WORLD: Milk-cream pages and print-ink type; one full-strength hue per division on the top edge of its leaf (orange, grass, teal, ultramarine, sienna; violet held out; vermilion reserved for errors); chrome-yellow primary actions with an ink outline; hairline-outlined leaves with one short hard shadow; condensed uppercase headlines in Archivo, EB Garamond body copy, Martian Mono for data only.
STORY: A visitor opens the manual at the overview, watches a CSV get checked, and pages through what Gridline does division by division, then acts: Explore the demo or Start free (equal).
FIRST VIEWPORT: Left, a tall condensed uppercase headline, a serif paragraph and both actions; right, a leaf holding a live inspection of a sample file.
FORM: The Tabbed Binder (rw-manual-acetate-tab-board), a dealt challenger chosen by the user, seed 121c4f71.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${garamond.variable} ${martian.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <div
          hidden
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a static constant that has to run before first paint
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
        <div
          hidden
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a static constant; React has no other way to emit an HTML comment
          dangerouslySetInnerHTML={{ __html: `<!--${DIRECTION_CONTRACT}-->` }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
