/** What a non-admin sees at an admin-only address: the same plain answer for every such page. */
export function AdminsOnly({ what }: { what: string }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-16 text-center sm:px-6">
      <h1 className="headline text-4xl">Admins only</h1>
      <p className="text-text-muted">
        Only your company&apos;s admins can open {what}. If you need something
        from it, ask one of them.
      </p>
    </div>
  );
}
