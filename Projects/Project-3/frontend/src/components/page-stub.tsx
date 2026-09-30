import type { ReactNode } from "react";

/** Holds a route's place until its page is built. Delete the import when the real page lands. */
export function PageStub({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="width-display text-3xl font-extrabold">{title}</h1>
      {children ? <p className="mt-3 text-text-muted">{children}</p> : null}
    </section>
  );
}
