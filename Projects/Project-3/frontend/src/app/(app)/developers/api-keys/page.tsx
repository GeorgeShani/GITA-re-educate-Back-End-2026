import { KeyRound } from "lucide-react";
import Link from "next/link";
import { Pager } from "@/components/app/pager";
import { Stamp } from "@/components/ui/stamp";
import { CreateKeyButton } from "@/features/api-keys/create-dialog";
import { RevokeButton } from "@/features/api-keys/revoke-button";
import { scopeLabel } from "@/features/api-keys/scopes";
import { exactTime, relativeTime } from "@/lib/format/time";
import { apiClient } from "@/lib/session/api";
import { actorName, loadPeople } from "@/lib/session/people";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "API keys" };

const PER_PAGE = 20;

function pageOf(value: string | string[] | undefined): number {
  const one = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(one ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function Page({
  searchParams,
}: PageProps<"/developers/api-keys">) {
  const session = await requireSession();
  const isAdmin = session.user.role === "admin";
  const page = pageOf((await searchParams).page);
  const api = apiClient(session.accessToken);
  const [keys, people] = await Promise.all([
    api.GET("/api-keys", { params: { query: { page, limit: PER_PAGE } } }),
    // Only an admin sees other people's keys, so only an admin needs their names.
    isAdmin ? loadPeople(api) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          API keys
        </h1>
        <p className="max-w-prose text-text-muted">
          Keys let a script, an integration or an AI agent work as you, with
          only the permissions you give them.{" "}
          <Link
            href="/docs/api-keys"
            className="font-semibold text-text underline underline-offset-2"
          >
            How to use a key
          </Link>
          .
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-muted">
          {keys.data
            ? isAdmin
              ? "Every key in your company."
              : "Your keys."
            : null}
        </p>
        <CreateKeyButton isAdmin={isAdmin} disabled={false} />
      </div>

      {keys.data ? (
        keys.data.data.length === 0 ? (
          <div className="leaf flex flex-col items-center gap-3 px-6 py-12 text-center">
            <KeyRound aria-hidden className="size-8 text-text-muted" />
            <p className="headline text-2xl">No keys yet</p>
            <p className="max-w-md text-text-muted">
              Make one when something outside Gridline needs to read or upload
              your files.
            </p>
          </div>
        ) : (
          <ul aria-label="API keys" className="leaf divide-y divide-line">
            {keys.data.data.map((key) => {
              const revoked = key.revokedAt !== null;
              return (
                <li
                  key={key.id}
                  className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4"
                >
                  <div
                    className={`flex min-w-0 flex-1 flex-col gap-1.5 ${revoked ? "opacity-60" : ""}`}
                  >
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold [overflow-wrap:anywhere]">
                        {key.name}
                      </span>
                      {revoked ? <Stamp tone="hold">Revoked</Stamp> : null}
                    </p>
                    <p className="font-mono text-sm text-text-muted">
                      {key.prefix}…
                    </p>
                    <ul
                      aria-label="What it may do"
                      className="flex flex-wrap gap-1.5"
                    >
                      {key.scopes.map((scope) => (
                        <li
                          key={scope}
                          className="rounded-xs border border-line-strong bg-sunken px-1.5 py-0.5 text-xs font-medium text-text-muted"
                        >
                          {scopeLabel(scope)}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-text-subtle">
                      {isAdmin
                        ? `${actorName(key.createdByUserId, people)} · `
                        : ""}
                      Created{" "}
                      <time
                        dateTime={key.createdAt}
                        title={exactTime(key.createdAt)}
                        suppressHydrationWarning
                      >
                        {relativeTime(key.createdAt)}
                      </time>
                      {" · "}
                      {key.lastUsedAt ? (
                        <>
                          Last used{" "}
                          <time
                            dateTime={key.lastUsedAt}
                            title={exactTime(key.lastUsedAt)}
                            suppressHydrationWarning
                          >
                            {relativeTime(key.lastUsedAt)}
                          </time>
                        </>
                      ) : (
                        "Never used"
                      )}
                    </p>
                  </div>
                  {revoked ? null : (
                    <RevokeButton id={key.id} name={key.name} />
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load your keys just now. Reload the page in a moment.
        </p>
      )}

      {keys.data ? (
        <Pager
          label="More keys"
          page={page}
          totalPages={keys.data.meta.totalPages}
          href={(next) =>
            next > 1
              ? `/developers/api-keys?page=${next}`
              : "/developers/api-keys"
          }
        />
      ) : null}
    </div>
  );
}
