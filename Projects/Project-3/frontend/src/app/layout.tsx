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
THESIS: Gridline accessions every spreadsheet on arrival: numbered, condition-checked, classified for who may read it. Refuses the gradient-hero, floating-screenshot, three-card SaaS template.
OWN-WORLD: Blue-slate archival box board as full-width fields; manila folder stock for the file itself; blue-black register ink; hairline ruling, no shadows; rubber-stamp inks (green PASS, vermilion HOLD, umber CAUTION) in a condensed face; sodium amber reserved for "being profiled now"; Martian Mono only for accession numbers and code.
STORY: A visitor watches a CSV arrive, receive its accession number and condition report, and get an access slip, then believes files here are known before they are used, and acts: Explore the demo or Start free (equal).
FIRST VIEWPORT: Left, a display headline on box-board field; right, a live register page where a CSV is accessioned line by line and stamped. Both actions sit under the headline, side by side.
FORM: The Accession Register, assigned candidate 6 of the grounded list, seed 121c4f71.
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
        <div hidden dangerouslySetInnerHTML={{ __html: `<!--${DIRECTION_CONTRACT}-->` }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
