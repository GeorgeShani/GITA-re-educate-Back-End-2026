import { type ReactNode, ViewTransition } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/** The Presentation layout: the public site (product, features, comparisons, pricing). */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* No page-to-page crossfade: it plays while the browser jumps to the top, so a visitor leaving the middle of a
            long page watched the old page fade as the scroll position reset. The jump is instant now; each page's own
            reveal motion still plays. */}
        <ViewTransition default="none">{children}</ViewTransition>
      </main>
      <SiteFooter />
    </div>
  );
}
