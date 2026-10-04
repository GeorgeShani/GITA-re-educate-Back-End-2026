"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, inputStyles } from "@/components/ui/field";
import { SENSITIVE_LABEL } from "@/features/file-detail/sensitive";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import { cn } from "@/lib/cn";
import {
  buildRule,
  COLUMN_KINDS,
  EMPTY_FORM,
  formFromRule,
  KINDS,
  kindInfo,
  type Rule,
  type RuleForm,
} from "./kinds";

const selectStyles = cn(inputStyles(), "pr-8");

/**
 * Adds a rule, or changes one (`rule` given). A rule's kind is fixed once made, so editing shows it but does not offer a
 * choice. Saving asks the API, then asks the server to draw the list again, so the list is always what was saved.
 */
export function RuleDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: Rule | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<RuleForm>(
    rule ? formFromRule(rule) : EMPTY_FORM,
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const info = kindInfo(form.kind);
  // Typing again clears the last complaint: it was about what was there before.
  const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => {
    setProblem(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const built = buildRule(form);
    if (!built.ok) {
      setProblem(built.error);
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = rule
      ? await callApi("PATCH", `/quality-rules/${rule.id}`, built.body)
      : await callApi("POST", "/quality-rules", {
          kind: form.kind,
          ...built.body,
        });
    if (succeeded(result)) {
      onOpenChange(false);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title={rule ? "Change rule" : "Add a rule"}
      description="Every file uploaded from now on is checked against it."
    >
      <form
        className="flex flex-col gap-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        noValidate
      >
        <Field label="Name" hint="How it will read in a report.">
          {(control) => (
            <Input
              {...control}
              value={form.name}
              maxLength={80}
              placeholder="Emails are filled in"
              onChange={(event) => set("name", event.target.value)}
              autoFocus
            />
          )}
        </Field>

        <Field
          label="What to check"
          hint={
            rule
              ? "A rule's kind cannot change. Delete it and add a new one to use another kind."
              : info.help
          }
        >
          {(control) => (
            <select
              {...control}
              className={selectStyles}
              value={form.kind}
              disabled={rule !== null}
              onChange={(event) => {
                const next = KINDS.find(
                  (entry) => entry.kind === event.target.value,
                );
                if (next) set("kind", next.kind);
              }}
            >
              {KINDS.map((entry) => (
                <option key={entry.kind} value={entry.kind}>
                  {entry.label}
                </option>
              ))}
            </select>
          )}
        </Field>

        {info.needsColumn ? (
          <Field
            label="Column"
            hint="The column's name as it appears in the file's header. Capitals do not matter."
          >
            {(control) => (
              <Input
                {...control}
                value={form.column}
                maxLength={200}
                placeholder="email"
                onChange={(event) => set("column", event.target.value)}
              />
            )}
          </Field>
        ) : null}

        {form.kind === "max_null_percent" ? (
          <Field label="Most that may be empty (%)" hint="0 to 100.">
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={form.max}
                placeholder="5"
                onChange={(event) => set("max", event.target.value)}
              />
            )}
          </Field>
        ) : null}

        {form.kind === "type_is" ? (
          <>
            <Field label="It must hold">
              {(control) => (
                <select
                  {...control}
                  className={selectStyles}
                  value={form.columnKind}
                  onChange={(event) => {
                    const next = COLUMN_KINDS.find(
                      (entry) => entry.value === event.target.value,
                    );
                    if (next) set("columnKind", next.value);
                  }}
                >
                  {COLUMN_KINDS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field
              label="Share allowed to disagree (%)"
              hint="0 means every value must match. 0 to 100."
            >
              {(control) => (
                <Input
                  {...control}
                  inputMode="decimal"
                  value={form.slack}
                  onChange={(event) => set("slack", event.target.value)}
                />
              )}
            </Field>
          </>
        ) : null}

        {form.kind === "min_value" ? (
          <Field label="Lowest allowed value">
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={form.min}
                placeholder="0"
                onChange={(event) => set("min", event.target.value)}
              />
            )}
          </Field>
        ) : null}

        {form.kind === "max_value" ? (
          <Field label="Highest allowed value">
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={form.max}
                placeholder="100"
                onChange={(event) => set("max", event.target.value)}
              />
            )}
          </Field>
        ) : null}

        {form.kind === "max_duplicate_rows" ? (
          <Field
            label="Most repeated rows allowed"
            hint="A whole number. 0 means no row may repeat."
          >
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={form.max}
                placeholder="0"
                onChange={(event) => set("max", event.target.value)}
              />
            )}
          </Field>
        ) : null}

        {form.kind === "no_sensitive_data" ? (
          <Field
            label="What to look for"
            hint="Found by patterns and checksums, never by reading meaning, so it can miss a column or flag one by mistake."
          >
            {(control) => (
              <select
                {...control}
                className={selectStyles}
                value={form.sensitiveKind}
                onChange={(event) => set("sensitiveKind", event.target.value)}
              >
                <option value="any">Any personal or secret data</option>
                {Object.entries(SENSITIVE_LABEL).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    Only {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            How serious is a failure?
          </legend>
          <Severity
            checked={form.severity === "error"}
            onSelect={() => set("severity", "error")}
            title="Error"
            note="Counts double in the score, and tells the uploader and every admin."
          />
          <Severity
            checked={form.severity === "warning"}
            onSelect={() => set("severity", "warning")}
            title="Warning"
            note="Only lowers the score. Nobody is notified."
          />
        </fieldset>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="size-4 accent-text"
            checked={form.enabled}
            onChange={(event) => set("enabled", event.target.checked)}
          />
          <span>
            <span className="font-medium">Check this rule</span>
            <span className="block text-sm text-text-muted">
              Switch it off to keep the rule without applying it.
            </span>
          </span>
        </label>

        {problem ? (
          <p role="alert" className="font-medium text-hold">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : null}
            {rule ? "Save changes" : "Add rule"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Severity({
  checked,
  onSelect,
  title,
  note,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  note: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors duration-(--duration-fast)",
        checked
          ? "border-text bg-sunken"
          : "border-line hover:border-line-strong",
      )}
    >
      <input
        type="radio"
        name="severity"
        className="mt-1 size-4 accent-text"
        checked={checked}
        onChange={onSelect}
      />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-text-muted">{note}</span>
      </span>
    </label>
  );
}
