import { Reveal } from "@/components/motion/reveal";
import { CopyButton } from "./exhibits/copy-button";

const UPLOAD = `curl -X POST "$GRIDLINE_URL/api/files" \\
  -H "Authorization: Bearer $GRIDLINE_API_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -F "file=@payroll-march.csv"`;

const WEBHOOK = `POST /your/endpoint
webhook-id: 6c1f9e2a-…
webhook-timestamp: 1790000000
webhook-signature: v1=3f8a…

{ "type": "report.ready", … }`;

const POINTS = [
  [
    "Scoped API keys",
    "A key acts as the person who made it, never with more than their role or its own scopes.",
  ],
  [
    "Signed webhooks",
    "Every delivery carries an HMAC signature over the exact body, so you can verify it came from Gridline.",
  ],
  [
    "Live updates",
    "Report status and quota arrive over Socket.IO as they change, with no polling.",
  ],
  [
    "Read-only GraphQL",
    "One request for a whole page of files, reports and versions.",
  ],
] as const;

/** The developer band: the same crate board, one shade deeper, with the two calls a technical lead would copy first. */
export function DevelopersBand() {
  return (
    <section
      id="developers"
      className="cover scroll-mt-16 bg-cover text-on-cover"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:py-20 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex min-w-0 flex-col gap-6">
          <h2 className="headline text-4xl leading-[0.98] sm:text-5xl">
            Connect it to the rest of your stack.
          </h2>
          <p className="max-w-prose copy text-on-cover-muted">
            The reference is generated from the API itself, so it cannot drift
            from what the API does.
          </p>
          <dl className="flex flex-col">
            {POINTS.map(([term, text]) => (
              <div
                key={term}
                className="flex flex-col gap-1 border-t border-on-cover/25 py-4"
              >
                <dt className="text-base font-semibold">{term}</dt>
                <dd className="text-sm text-on-cover-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={120} className="flex min-w-0 flex-col gap-4">
          <Snippet
            title="Upload a file"
            code={UPLOAD}
            label="Copy the upload command"
          />
          <Snippet
            title="What your endpoint receives"
            code={WEBHOOK}
            label="Copy the webhook example"
          />
        </Reveal>
      </div>
    </section>
  );
}

function Snippet({
  title,
  code,
  label,
}: {
  title: string;
  code: string;
  label: string;
}) {
  return (
    <figure className="overflow-hidden rounded-md border border-on-cover/40 bg-surface text-text">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 text-sm font-medium">
        {title}
        <CopyButton text={code} label={label} />
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
