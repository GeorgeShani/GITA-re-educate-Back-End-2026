import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminsOnly } from "@/components/app/admins-only";
import { actionLabel } from "@/features/audit/actions";
import { targetHref, targetWord } from "@/features/audit/target";
import { exactTime } from "@/lib/format/time";
import { apiClient } from "@/lib/session/api";
import { actorName, loadPeople } from "@/lib/session/people";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Audit entry" };

/** A metadata value as one line of text, or `null` when it is a structure that should be shown whole. */
function plain(value: unknown): string | null {
  if (value === null) return "none";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export default async function Page({ params }: PageProps<"/audit/[id]">) {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    return <AdminsOnly what="the audit log" />;
  }
  const { id } = await params;
  const api = apiClient(session.accessToken);
  const [entry, people] = await Promise.all([
    api.GET("/audit/{id}", { params: { path: { id } } }),
    loadPeople(api),
  ]);
  if (entry.response.status === 404 || entry.response.status === 400) {
    notFound();
  }
  const data = entry.data;
  const where = data ? targetHref(data.targetType, data.targetId) : null;
  const details = data ? Object.entries(data.metadata) : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href="/audit"
        className="inline-flex w-fit items-center gap-1.5 text-text-muted hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Audit log
      </Link>

      {data ? (
        <>
          <header className="flex flex-col gap-2">
            <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
              {actionLabel(data.action)}
            </h1>
            <p className="text-text-muted">
              {actorName(data.actorUserId, people)} ·{" "}
              <time dateTime={data.createdAt} className="num">
                {exactTime(data.createdAt)}
              </time>
            </p>
          </header>

          <dl className="leaf grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
            <Fact label="Action">
              <code className="font-mono text-sm">{data.action}</code>
            </Fact>
            <Fact label="Acted on">
              {data.targetType ? (
                <>
                  {targetWord(data.targetType)}
                  {data.targetId ? (
                    <>
                      {" "}
                      <code className="font-mono text-sm [overflow-wrap:anywhere]">
                        {data.targetId}
                      </code>
                    </>
                  ) : null}
                  {where ? (
                    <>
                      {" "}
                      <Link
                        href={where}
                        className="font-semibold underline underline-offset-2"
                      >
                        Open
                      </Link>
                    </>
                  ) : null}
                </>
              ) : (
                "Nothing in particular"
              )}
            </Fact>
            <Fact label="From">
              {data.ip ? (
                <code className="font-mono text-sm">{data.ip}</code>
              ) : (
                "Not over HTTP"
              )}
            </Fact>
            <Fact label="Request">
              {data.correlationId ? (
                <code className="font-mono text-sm [overflow-wrap:anywhere]">
                  {data.correlationId}
                </code>
              ) : (
                "None"
              )}
            </Fact>
          </dl>

          <section
            aria-labelledby="details-heading"
            className="flex flex-col gap-3"
          >
            <h2 id="details-heading" className="text-2xl font-semibold">
              Details
            </h2>
            {details.length === 0 ? (
              <p className="text-text-muted">
                This action records nothing beyond the above.
              </p>
            ) : (
              <dl className="leaf divide-y divide-line">
                {details.map(([key, value]) => {
                  const text = plain(value);
                  return (
                    <div
                      key={key}
                      className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4"
                    >
                      <dt className="font-mono text-sm text-text-muted [overflow-wrap:anywhere]">
                        {key}
                      </dt>
                      <dd className="min-w-0">
                        {text !== null ? (
                          <span className="[overflow-wrap:anywhere]">
                            {text}
                          </span>
                        ) : (
                          <pre className="overflow-x-auto rounded-xs bg-sunken p-2 font-mono text-sm">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </section>
        </>
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load this entry just now. Reload the page in a moment.
        </p>
      )}
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
