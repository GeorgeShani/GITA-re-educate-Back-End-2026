import { FileSpreadsheet, UserPlus } from "lucide-react";
import Link from "next/link";
import { PLAN_LABEL } from "@/components/marketing/pricing/plan-copy";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/session/session";
import { getSubscription } from "@/lib/session/subscription";

export const metadata = { title: "Dashboard" };

const DUE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** The first page of the application: who you are working as, what this period has used, and what to do next. */
export default async function Page() {
  const session = await requireSession();
  const { data } = await getSubscription(session.accessToken);
  const isAdmin = session.user.role === "admin";
  const firstName =
    session.user.fullName.split(/\s+/)[0] ?? session.user.fullName;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Hello, {firstName}
        </h1>
        <p className="text-text-muted">
          {session.company.name}
          {data ? ` · ${PLAN_LABEL[data.plan]} plan` : ""}
        </p>
      </header>

      {data ? (
        <section
          aria-label="This billing period"
          className="grid gap-4 sm:grid-cols-3"
        >
          <Figure
            label="Files this period"
            value={data.usage.files.toLocaleString("en-US")}
            note={`of ${data.limits.filesPerPeriod.toLocaleString("en-US")} included`}
          />
          <Figure
            label="Seats in use"
            value={data.usage.seats.toLocaleString("en-US")}
            note={
              data.limits.maxSeats === null
                ? "no seat limit"
                : `of ${data.limits.maxSeats.toLocaleString("en-US")}`
            }
          />
          <Figure
            label="Period ends"
            value={DUE.format(new Date(data.nextDueDate))}
            note="the next invoice is cut then"
          />
        </section>
      ) : null}

      <section aria-label="Next steps" className="flex flex-wrap gap-3">
        <Button asChild variant="primary" size="lg">
          <Link href="/files">
            <FileSpreadsheet aria-hidden />
            Go to your files
          </Link>
        </Button>
        {isAdmin ? (
          <Button asChild size="lg">
            <Link href="/employees">
              <UserPlus aria-hidden />
              Invite your team
            </Link>
          </Button>
        ) : null}
      </section>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="leaf flex flex-col gap-1 p-4">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className="num font-mono text-3xl font-semibold">{value}</p>
      <p className="text-sm text-text-muted">{note}</p>
    </div>
  );
}
