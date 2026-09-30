import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/** Centered layout for sign-in, registration, activation, invitations and password reset. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <Link href="/" aria-label="Gridline home" className="self-start">
        <Logo />
      </Link>
      {children}
    </main>
  );
}
