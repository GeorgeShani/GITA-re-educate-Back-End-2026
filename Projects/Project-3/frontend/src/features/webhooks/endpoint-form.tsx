"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded, textOf } from "@/lib/api/call";
import { cn } from "@/lib/cn";
import { EVENTS, type WebhookEvent } from "./events";
import { SecretReveal } from "./secret-reveal";

interface Values {
  name: string;
  url: string;
  events: readonly WebhookEvent[];
}

/** What is wrong with the form before it is sent, in words that say what to do; `null` when it can go. */
function check(values: Values): string | null {
  if (values.name.trim() === "") {
    return "Name the endpoint, so you can tell them apart.";
  }
  let parsed: URL | null = null;
  try {
    parsed = new URL(values.url.trim());
  } catch {
    parsed = null;
  }
  if (
    !parsed ||
    (parsed.protocol !== "https:" && parsed.protocol !== "http:")
  ) {
    return "Enter the full address your receiver listens on, like https://example.com/hooks/gridline.";
  }
  if (values.events.length === 0) {
    return "Choose at least one event to send.";
  }
  return null;
}

function Fields({
  values,
  busy,
  onChange,
}: {
  values: Values;
  busy: boolean;
  onChange: (next: Values) => void;
}) {
  const toggle = (id: WebhookEvent) =>
    onChange({
      ...values,
      events: values.events.includes(id)
        ? values.events.filter((event) => event !== id)
        : [...values.events, id],
    });
  return (
    <>
      <Field label="Name" hint="What it is for: “Slack relay”.">
        {(control) => (
          <Input
            {...control}
            value={values.name}
            maxLength={80}
            autoComplete="off"
            disabled={busy}
            onChange={(event) =>
              onChange({ ...values, name: event.target.value })
            }
          />
        )}
      </Field>
      <Field
        label="Address"
        hint="Gridline sends a signed POST here. It must be reachable from the internet."
      >
        {(control) => (
          <Input
            {...control}
            type="url"
            value={values.url}
            autoComplete="off"
            placeholder="https://example.com/hooks/gridline"
            disabled={busy}
            onChange={(event) =>
              onChange({ ...values, url: event.target.value })
            }
          />
        )}
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">What to send</legend>
        {EVENTS.map((event) => {
          const checked = values.events.includes(event.id);
          return (
            <label
              key={event.id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-md border p-3 hover:bg-sunken",
                checked ? "border-text bg-sunken" : "border-line",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={busy}
                onChange={() => toggle(event.id)}
                className="mt-1 size-4 accent-[var(--color-text)]"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{event.label}</span>
                <span className="text-sm text-text-muted">
                  {event.description}{" "}
                  <code className="font-mono text-xs">{event.id}</code>
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
    </>
  );
}

/** "Add an endpoint": the dialog that makes one, and then shows its signing secret exactly once. */
export function CreateEndpointButton({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden />
        Add an endpoint
      </Button>
      {open ? <CreateDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({
    name: "",
    url: "",
    events: EVENTS.map((event) => event.id),
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const create = async () => {
    const wrong = check(values);
    if (wrong) {
      setProblem(wrong);
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await callApi("POST", "/outgoing-webhooks", {
      name: values.name.trim(),
      url: values.url.trim(),
      events: values.events,
    });
    const made = succeeded(result) ? textOf(result.body, "secret") : null;
    if (made) {
      setSecret(made);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  if (secret) {
    return (
      <SecretReveal title="Endpoint added" secret={secret} onClose={onClose} />
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      title="Add an endpoint"
      description="Gridline tells your system when something happens, signed so you can trust it."
    >
      <form
        className="flex flex-col gap-5 p-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <Fields
          values={values}
          busy={busy}
          onChange={(next) => {
            setProblem(null);
            setValues(next);
          }}
        />
        {problem ? (
          <p role="alert" className="font-medium text-hold">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : null}
            Add endpoint
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** The settings of an existing endpoint, edited in place. */
export function EditEndpointForm({
  id,
  initial,
}: {
  id: string;
  initial: Values;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const wrong = check(values);
    if (wrong) {
      setProblem(wrong);
      return;
    }
    setBusy(true);
    setProblem(null);
    setSaved(false);
    const result = await callApi("PATCH", `/outgoing-webhooks/${id}`, {
      name: values.name.trim(),
      url: values.url.trim(),
      events: values.events,
    });
    if (succeeded(result)) {
      setSaved(true);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <form
      className="leaf flex flex-col gap-5 p-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Fields
        values={values}
        busy={busy}
        onChange={(next) => {
          setProblem(null);
          setSaved(false);
          setValues(next);
        }}
      />
      {problem ? (
        <p role="alert" className="font-medium text-hold">
          {problem}
        </p>
      ) : null}
      {saved ? (
        <output className="block font-medium text-pass">Saved.</output>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}
