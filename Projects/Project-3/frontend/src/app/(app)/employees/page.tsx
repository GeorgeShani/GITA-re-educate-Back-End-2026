import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import { InviteButton } from "@/features/people/invite-dialog";
import { PersonActions } from "@/features/people/person-actions";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/cn";
import { exactTime, relativeTime } from "@/lib/format/time";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "People" };

type Person = components["schemas"]["EmployeeDto"];

const PER_PAGE = 20;

const TABS = [
  { id: "", label: "Everyone" },
  { id: "active", label: "Active" },
  { id: "invited", label: "Invited" },
  { id: "disabled", label: "Removed" },
] as const;

type StatusFilter = "active" | "invited" | "disabled" | undefined;

function toFilter(value: string | string[] | undefined): StatusFilter {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "active" || one === "invited" || one === "disabled"
    ? one
    : undefined;
}

export default async function Page({ searchParams }: PageProps<"/employees">) {
  const session = await requireSession();
  const query = await searchParams;
  const status = toFilter(query.status);
  const rawPage = Number.parseInt(
    (Array.isArray(query.page) ? query.page[0] : query.page) ?? "1",
    10,
  );
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  // Only admins have this page. An employee who types the address gets the same plain answer as an unknown page.
  if (session.user.role !== "admin") return <AdminsOnly />;

  const api = apiClient(session.accessToken);
  const [people, subscription] = await Promise.all([
    api.GET("/employees", {
      params: {
        query: { page, limit: PER_PAGE, ...(status ? { status } : {}) },
      },
    }),
    api.GET("/subscriptions/me"),
  ]);

  const limit = subscription.data?.limits.maxEmployees ?? null;
  const held = subscription.data?.usage.employees ?? 0;
  const full = limit !== null && held >= limit;
  const canWrite = !session.company.isDemo;

  const href = (next: { status?: StatusFilter; page?: number }) => {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const text = params.toString();
    return text ? `/employees?${text}` : "/employees";
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">People</h1>
        <p className="max-w-prose text-text-muted">
          Everyone in your company. Invite colleagues, and remove them when they
          leave.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-muted">
          {subscription.data ? (
            <>
              <span className="num font-mono font-semibold text-text">
                {held}
              </span>
              {limit === null
                ? " employees"
                : ` of ${limit} ${limit === 1 ? "employee" : "employees"} on your plan`}
            </>
          ) : null}
        </p>
        {canWrite ? <InviteButton disabled={full} /> : null}
      </div>

      {full && canWrite ? (
        <p
          role="note"
          className="rounded-md border border-caution bg-caution-soft p-3 text-caution"
        >
          {limit === 0
            ? "The Free plan is for one person, so there is nobody to invite."
            : `Your plan allows ${limit} employees and they are all taken.`}{" "}
          <Link
            href="/billing"
            className="font-semibold underline underline-offset-2"
          >
            See the plans
          </Link>{" "}
          to make room.
        </p>
      ) : null}

      <nav
        aria-label="Which people"
        className="-mb-2 flex overflow-x-auto border-b border-line scrollbar-none"
      >
        {TABS.map((tab) => {
          const on = (status ?? "") === tab.id;
          return (
            <Link
              key={tab.label}
              href={href({ status: tab.id === "" ? undefined : tab.id })}
              replace
              aria-current={on ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-4 py-2.5 font-semibold transition-colors duration-(--duration-fast)",
                on
                  ? "border-text text-text"
                  : "border-transparent text-text-muted hover:border-line-strong hover:text-text",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {people.data ? (
        <>
          {people.data.data.length === 0 ? (
            <div className="leaf flex flex-col items-center gap-3 px-6 py-12 text-center">
              <Users aria-hidden className="size-8 text-text-muted" />
              <p className="headline text-2xl">
                {status ? "Nobody here" : "It is just you so far"}
              </p>
              <p className="max-w-md text-text-muted">
                {status
                  ? "Nobody is in this group right now."
                  : "Invite a colleague and they can upload files, read the ones shared with them and comment."}
              </p>
            </div>
          ) : (
            <ul aria-label="People" className="leaf divide-y divide-line">
              {people.data.data.map((person) => (
                <Row
                  key={person.id}
                  person={person}
                  isMe={person.id === session.user.id}
                  canWrite={canWrite}
                />
              ))}
            </ul>
          )}

          {people.data.meta.totalPages > 1 ? (
            <nav
              aria-label="More people"
              className="flex items-center justify-between gap-3"
            >
              <Button asChild size="sm" aria-disabled={page <= 1}>
                <Link href={href({ status, page: Math.max(1, page - 1) })}>
                  <ArrowLeft aria-hidden />
                  Previous
                </Link>
              </Button>
              <p className="text-sm text-text-muted">
                Page <span className="num font-mono">{page}</span> of{" "}
                <span className="num font-mono">
                  {people.data.meta.totalPages}
                </span>
              </p>
              <Button
                asChild
                size="sm"
                aria-disabled={page >= people.data.meta.totalPages}
              >
                <Link
                  href={href({
                    status,
                    page: Math.min(people.data.meta.totalPages, page + 1),
                  })}
                >
                  Next
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </nav>
          ) : null}
        </>
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load your people just now. Reload the page in a moment.
        </p>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

function Row({
  person,
  isMe,
  canWrite,
}: {
  person: Person;
  isMe: boolean;
  canWrite: boolean;
}) {
  const when =
    person.status === "active" && person.activatedAt
      ? { label: "Joined", at: person.activatedAt }
      : person.status === "disabled" && person.disabledAt
        ? { label: "Removed", at: person.disabledAt }
        : { label: "Invited", at: person.createdAt };
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-text bg-tag text-sm font-bold text-on-tag"
      >
        {initials(person.fullName)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold [overflow-wrap:anywhere]">
            {person.fullName}
          </span>
          {isMe ? <span className="text-sm text-text-muted">(you)</span> : null}
          {person.role === "admin" ? <Stamp tone="idle">Admin</Stamp> : null}
          {person.status === "invited" ? (
            <Stamp tone="caution">Invited</Stamp>
          ) : null}
          {person.status === "disabled" ? (
            <Stamp tone="hold">Removed</Stamp>
          ) : null}
        </p>
        <p className="truncate text-text-muted">{person.email}</p>
        <p className="text-sm text-text-subtle">
          {when.label}{" "}
          <time
            dateTime={when.at}
            title={exactTime(when.at)}
            suppressHydrationWarning
          >
            {relativeTime(when.at)}
          </time>
        </p>
      </div>
      {canWrite && person.role === "employee" ? (
        <PersonActions
          id={person.id}
          name={person.fullName}
          status={person.status}
        />
      ) : null}
    </li>
  );
}

function AdminsOnly() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-16 text-center sm:px-6">
      <h1 className="headline text-4xl">Admins only</h1>
      <p className="text-text-muted">
        Managing people is for your company&apos;s admins. If you need someone
        invited or removed, ask one of them.
      </p>
    </div>
  );
}
