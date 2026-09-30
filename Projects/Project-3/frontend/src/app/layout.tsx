import type { Metadata } from "next";
import { Archivo, Martian_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// One family, three voices through its width axis: condensed for stamps, normal for text, expanded for display.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
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
    "Where a company's spreadsheets live: checked on arrival, permissioned per person, versioned, and billed by seat and volume.",
};

// The direction contract is rendered as the first child of <body> (an HTML comment), so it survives the production build.
const DIRECTION_CONTRACT = `
THESIS: Every file clears the receiving dock: inspected on arrival and tagged PASS or HOLD before anyone uses it. Refuses the gradient-hero, floating-screenshot, three-card SaaS template.
OWN-WORLD: Kraft crate board as full-width marketing fields; label-stock paper and stencil-black ink everywhere else; hi-vis inspection-tag yellow for the brand tag and, in the product, ONLY for being inspected now; PASS green and HOLD vermilion as rubber stamps in a condensed face; hairline ruling, no shadows; Martian Mono only for barcodes, ids and code.
STORY: A visitor watches a CSV roll in, get inspected, and leave with a tag and a score, then believes files here are known before they are used, and acts: Explore the demo or Start free (equal).
FIRST VIEWPORT: Left, a stencil-weight display headline on kraft board; right, a pallet label for an incoming CSV with its inspection tag and rule checks printing line by line. Both actions sit under the headline, side by side.
FORM: Inspected on Arrival, the model pick, seed 121c4f71, chosen by the user.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${martian.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
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
