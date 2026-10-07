"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * What a suspended company's people see instead of its pages: an admin can still open Billing (the one place that lets them
 * pay), and everything else, for everyone, says why it is closed.
 *
 * It decides from the address the browser is at NOW. The app's layout is not drawn again when someone clicks between pages,
 * so a decision made there from the address at the first load would go stale at the first click.
 */
export function SuspendedGate({
  admin,
  children,
}: {
  admin: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (admin && pathname.startsWith("/billing")) return children;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 px-6 py-16">
      <h1 className="headline text-4xl leading-[0.98]">
        Your company is suspended
      </h1>
      {admin ? (
        <>
          <p className="text-text-muted">
            An invoice is overdue, so files and reports are closed to everyone
            until it is paid. Billing is the one page that still opens. Nothing
            has been deleted.
          </p>
          <Button variant="primary" asChild>
            <Link href="/billing">Open billing</Link>
          </Button>
        </>
      ) : (
        <p className="text-text-muted">
          An invoice is overdue, so files and reports are closed to everyone
          until it is paid. Ask your admin to open Billing and pay it. Nothing
          has been deleted.
        </p>
      )}
    </div>
  );
}
