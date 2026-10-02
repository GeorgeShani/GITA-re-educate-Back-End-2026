import { messageForError } from "@/features/auth/messages";
import { LinkedAccounts } from "@/features/settings/linked-accounts";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Linked accounts" };

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({
  searchParams,
}: PageProps<"/settings/linked-accounts">) {
  const session = await requireSession();
  const query = await searchParams;
  const identities = await apiClient(session.accessToken).GET(
    "/auth/identities",
  );
  const failure = messageForError(firstOf(query.error));
  const linked = firstOf(query.linked) === "google";

  return (
    <section aria-labelledby="linked-heading" className="flex flex-col gap-4">
      <h2 id="linked-heading" className="text-2xl font-semibold">
        Linked accounts
      </h2>
      <p className="max-w-prose text-text-muted">
        The ways you can sign in to Gridline. You always keep at least one.
      </p>

      {linked ? (
        <output className="block max-w-xl rounded-md border border-pass bg-pass-soft p-3 font-medium text-pass">
          Google is connected. You can now sign in with it.
        </output>
      ) : null}
      {failure ? (
        <p
          role="alert"
          className="max-w-xl rounded-md border border-hold bg-hold-soft p-3 font-medium text-hold"
        >
          {failure}
        </p>
      ) : null}

      {identities.data ? (
        <LinkedAccounts
          identities={identities.data.data.map((identity) => ({
            id: identity.id,
            provider: identity.provider,
            email: identity.email,
            lastUsedAt: identity.lastUsedAt,
          }))}
        />
      ) : (
        <p
          role="alert"
          className="max-w-xl rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load your sign-in methods just now. Reload the page in a
          moment.
        </p>
      )}
    </section>
  );
}
