import { type ReactNode, ViewTransition } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/** The Presentation layout: the public site (product, features, comparisons, pricing). */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <ViewTransition>{children}</ViewTransition>
      </main>
      <SiteFooter />
    </div>
  );
}
