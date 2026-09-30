import { notFound } from "next/navigation";
import { Logo, Mark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Stamp } from "@/components/ui/stamp";

export const metadata = { title: "Kit", robots: { index: false } };

/** Every token and component on one page, light and dark side by side. Development only. */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <Panel theme="light" />
      <Panel theme="dark" />
    </main>
  );
}

function Panel({ theme }: { theme: "light" | "dark" }) {
  return (
    <section
      data-theme={theme}
      className="flex flex-col gap-10 bg-canvas p-8 text-text"
    >
      <h1 className="width-display text-2xl font-extrabold capitalize">
        {theme}
      </h1>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text-muted">Logo</h2>
        <Logo className="text-2xl" markClassName="size-10" />
        <div className="flex items-end gap-5">
          <Mark className="size-16" title="Gridline" />
          <Mark className="size-10" title="Gridline" />
          <Mark className="size-6" title="Gridline" />
          <Mark className="size-4" title="Gridline" />
        </div>
        <div className="flex items-center gap-4 rounded-md bg-field p-5 text-on-field">
          <Logo />
          <span className="text-sm">on crate board</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-muted">Stamps</h2>
        <div className="flex flex-wrap gap-2">
          <Stamp tone="pass">Passed</Stamp>
          <Stamp tone="hold">Held</Stamp>
          <Stamp tone="caution">80% used</Stamp>
          <Stamp tone="live">Inspecting</Stamp>
          <Stamp tone="idle">Queued</Stamp>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-muted">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Explore the demo</Button>
          <Button>Start free</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Revoke key</Button>
        </div>
        <div className="flex flex-wrap gap-2 rounded-md bg-field p-4">
          <Button variant="onField">Explore the demo</Button>
          <Button variant="onFieldOutline">Start free</Button>
        </div>
      </div>

      <div className="max-w-sm">
        <Field
          label="Company email"
          hint="The address invoices are sent to."
          error="Enter an address like name@company.com."
        >
          {(control) => <Input {...control} defaultValue="accounts@" />}
        </Field>
      </div>

      <p className="num font-mono text-sm">
        GL-2026-000184 · 1,204 rows · $300.00 · 24.6 MB
      </p>
    </section>
  );
}
