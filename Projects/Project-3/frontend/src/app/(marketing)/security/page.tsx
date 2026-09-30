import type { ReactNode } from "react";
import { PageHead } from "@/components/marketing/page-head";
import { Reveal } from "@/components/motion/reveal";
import { Stamp } from "@/components/ui/stamp";

export const metadata = {
  title: "Security",
  description:
    "How Gridline keeps one company's spreadsheets from another, how sign-in and API keys work, and the limits we state plainly.",
};

interface Topic {
  id: string;
  title: string;
  body: ReactNode;
  points: readonly string[];
}

const TOPICS: Topic[] = [
  {
    id: "tenants",
    title: "One company’s data is invisible to another.",
    body: (
      <p>
        Every query is scoped to your company, and the company comes from the
        signed-in person&rsquo;s own record, never from a URL or a request body.
        Another company&rsquo;s file is not forbidden: it is not found.
      </p>
    ),
    points: [
      "A file you may not see answers 404, exactly as a file that does not exist would.",
      "Within a company, a restricted file is visible only to its uploader, the people it names, and admins.",
      "Role, status and company standing are read from the database on every request, so removing someone takes effect on their next request.",
    ],
  },
  {
    id: "sessions",
    title: "Sign-in and sessions.",
    body: (
      <p>
        Passwords are hashed with scrypt and never stored or logged. Sessions
        use short-lived access tokens and refresh tokens that rotate.
      </p>
    ),
    points: [
      "Reusing a spent refresh token revokes the whole session family.",
      "Changing or resetting a password revokes the person’s other sessions.",
      "Sign-in with Google is supported, and the last way to sign in to an account cannot be removed.",
      "A wrong password and an unknown email get the same answer, and the same amount of work.",
    ],
  },
  {
    id: "keys",
    title: "API keys that can only do what you said.",
    body: (
      <p>
        A key acts as the person who created it, and never with more than that
        person&rsquo;s role or the scopes chosen for the key. The key is shown
        once; only a hash is stored.
      </p>
    ),
    points: [
      "Keys are denied by default: a route is reachable by a key only when it explicitly allows one.",
      "A key cannot create keys, invite people, change a plan or read the audit log.",
      "Removing a person revokes their keys.",
    ],
  },
  {
    id: "files",
    title: "Files stay private.",
    body: (
      <p>
        Uploads go to a private bucket. A download link is minted only after the
        access check and expires after five minutes.
      </p>
    ),
    points: [
      "The type of a file is decided from its bytes, never from its name or declared type: an executable renamed .csv is refused.",
      "A refused or failed upload stores nothing and uses no quota.",
      "The optional AI summary is built from aggregate statistics only. It is never shown a row or a cell value.",
    ],
  },
  {
    id: "audit",
    title: "A record that cannot be edited.",
    body: (
      <p>
        Every state change is written to the audit log in the same transaction
        as the change, and the database rejects any update or delete of that
        table.
      </p>
    ),
    points: [
      "Entries record who acted, on what, when, and from which key if one was used.",
      "Admins can filter the log and open any entry.",
    ],
  },
  {
    id: "webhooks",
    title: "Signed webhooks that cannot be turned on you.",
    body: (
      <p>
        Every delivery is signed with HMAC-SHA256 over its exact body, so your
        endpoint can verify it. Secrets are shown once and stored encrypted.
      </p>
    ),
    points: [
      "Deliveries resolve DNS on every attempt and refuse private, loopback and reserved addresses, so a webhook cannot be aimed at an internal service.",
      "Redirects are never followed.",
      "Only admins, through a signed-in session, can create endpoints. An API key cannot.",
    ],
  },
  {
    id: "payments",
    title: "Payments belong to Stripe.",
    body: (
      <p>
        Card details are entered with Stripe and never touch Gridline.
        Stripe&rsquo;s notifications are verified by signature and processed
        once each, whatever order they arrive in.
      </p>
    ),
    points: [
      "A plan changes from a verified Stripe event, not from a request to Gridline.",
      "A failed payment starts a grace period before a company is suspended.",
    ],
  },
  {
    id: "abuse",
    title: "Limits that follow the plan.",
    body: (
      <p>
        Each plan has a request budget shared by the whole company, so one busy
        integration cannot starve the others. Sign-in, password reset and
        similar routes have small limits of their own.
      </p>
    ),
    points: [],
  },
];

const LIMITS = [
  "Realtime updates and request limits run on a single API instance today, so they are not shared across servers.",
  "There is no self-service company deletion or data export yet.",
  "A crash in the middle of an upload can leave a stored file that no record points to. There is no sweeper for those yet.",
  "Rotating a webhook secret has no overlap period, so a delivery in flight when you rotate is signed with the new secret.",
];

export default function Page() {
  return (
    <>
      <PageHead title={["How your files", "are kept apart."]}>
        <p>
          What follows is how Gridline is built today, described without
          adjectives. Where something is missing, it is listed under known
          limits.
        </p>
      </PageHead>

      {TOPICS.map((topic) => (
        <section
          key={topic.id}
          id={topic.id}
          className="scroll-mt-16 border-b border-line"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 md:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <Reveal>
              <h2 className="headline text-3xl leading-[1] sm:text-4xl">
                {topic.title}
              </h2>
            </Reveal>
            <Reveal delay={100} className="flex min-w-0 flex-col gap-5">
              <div className="copy max-w-prose text-text-muted">
                {topic.body}
              </div>
              {topic.points.length > 0 ? (
                <ul className="flex flex-col border-t border-line-strong">
                  {topic.points.map((point) => (
                    <li
                      key={point}
                      className="border-b border-line py-3 text-base"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              ) : null}
              {topic.id === "tenants" ? <NotFound /> : null}
            </Reveal>
          </div>
        </section>
      ))}

      <section id="limits" className="scroll-mt-16">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-14 md:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <Reveal className="flex flex-col gap-4">
            <h2 className="headline text-3xl leading-[1] sm:text-4xl">
              Known limits, and what we do not claim.
            </h2>
            <p className="copy max-w-prose text-text-muted">
              Gridline has not been through a SOC 2 or ISO 27001 audit and does
              not claim any certification. These are the gaps we know about.
            </p>
          </Reveal>
          <Reveal delay={100} className="min-w-0">
            <ul className="flex flex-col border-t border-line-strong">
              {LIMITS.map((limit) => (
                <li key={limit} className="border-b border-line py-4 text-base">
                  {limit}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/** The one request that shows what "not found" means: the same answer for a file that is not yours and one that is not there. */
function NotFound() {
  return (
    <figure className="leaf flex flex-col gap-3 p-5 font-mono text-xs">
      <figcaption className="font-sans text-sm font-semibold text-text-muted">
        Two requests, one answer
      </figcaption>
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <span className="min-w-0 truncate">
          GET /files/&lt;a file in another company&gt;
        </span>
        <Stamp tone="hold">404 Not found</Stamp>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate">
          GET /files/&lt;an id that never existed&gt;
        </span>
        <Stamp tone="hold">404 Not found</Stamp>
      </div>
    </figure>
  );
}
