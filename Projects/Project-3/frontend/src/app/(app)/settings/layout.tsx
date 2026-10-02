import type { ReactNode } from "react";
import { SettingsNav } from "@/features/settings/settings-nav";
import { requireSession } from "@/lib/session/session";

/** The frame around every Settings page: a heading, the sections, and the page itself. */
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  const isAdmin = session.user.role === "admin";
  const items = [
    { href: "/settings/profile", label: "Profile" },
    { href: "/settings/security", label: "Password and security" },
    { href: "/settings/linked-accounts", label: "Linked accounts" },
    ...(isAdmin ? [{ href: "/settings/company", label: "Company" }] : []),
  ];
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Settings
        </h1>
        <p className="max-w-prose text-text-muted">
          Your account, how you sign in, and your company.
        </p>
      </header>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <SettingsNav items={items} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
