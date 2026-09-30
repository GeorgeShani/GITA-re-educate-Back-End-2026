import type { ReactNode } from "react";
import { RailNav } from "@/components/app/rail-nav";

/** The Application layout: the company dashboard. A rail on the left, the work on the right. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1">
      <RailNav />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
