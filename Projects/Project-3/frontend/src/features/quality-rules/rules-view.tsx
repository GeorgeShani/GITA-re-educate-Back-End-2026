"use client";

import { ListChecks, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Stamp } from "@/components/ui/stamp";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import { cn } from "@/lib/cn";
import { describeRule, kindInfo, type Rule } from "./kinds";
import { RuleDialog } from "./rule-form";

/** The dialog being shown: none, a new rule, or one being changed. */
type Editing =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "edit"; rule: Rule };

/**
 * The company's rules, and, for an admin, the means to change them. An employee sees the same list without the buttons:
 * they should know what an upload is checked against even though they cannot change it.
 */
export function RulesView({
  rules,
  canEdit,
  limit,
  total,
}: {
  rules: readonly Rule[];
  canEdit: boolean;
  /** How many rules the plan allows; `null` for no limit or when it could not be read. */
  limit: number | null;
  total: number;
}) {
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const atLimit = limit !== null && total >= limit;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-muted">
          <span className="num font-mono font-semibold text-text">{total}</span>
          {limit === null ? " rules" : ` of ${limit} rules on your plan`}
          {!canEdit ? ". Only admins can change them." : ""}
        </p>
        {canEdit ? (
          <Button
            variant="primary"
            onClick={() => setEditing({ kind: "new" })}
            disabled={atLimit}
          >
            <Plus aria-hidden />
            Add a rule
          </Button>
        ) : null}
      </div>

      {atLimit && canEdit ? (
        <p
          role="note"
          className="rounded-md border border-caution bg-caution-soft p-3 text-caution"
        >
          Your plan allows {limit} {limit === 1 ? "rule" : "rules"} and you have
          them all.{" "}
          <Link
            href="/billing"
            className="font-semibold underline underline-offset-2"
          >
            See the plans
          </Link>{" "}
          or delete a rule to make room.
        </p>
      ) : null}

      {rules.length === 0 ? (
        <div className="leaf flex flex-col items-center gap-3 px-6 py-12 text-center">
          <ListChecks aria-hidden className="size-8 text-text-muted" />
          <p className="headline text-2xl">No rules yet</p>
          <p className="max-w-md text-text-muted">
            A rule says what good data means for your company, such as “at most
            5% of the email column may be empty”. Every upload is checked
            against your rules and scored.
          </p>
          {canEdit ? (
            <Button
              variant="primary"
              onClick={() => setEditing({ kind: "new" })}
            >
              <Plus aria-hidden />
              Add your first rule
            </Button>
          ) : (
            <p className="text-text-muted">Ask an admin to add some.</p>
          )}
        </div>
      ) : (
        <ul aria-label="Quality rules" className="leaf divide-y divide-line">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              canEdit={canEdit}
              onEdit={() => setEditing({ kind: "edit", rule })}
            />
          ))}
        </ul>
      )}

      {editing.kind === "none" ? null : (
        <RuleDialog
          // A fresh form each time it opens, so one rule's numbers never linger in the next.
          key={editing.kind === "edit" ? editing.rule.id : "new"}
          open
          onOpenChange={(open) => {
            if (!open) setEditing({ kind: "none" });
          }}
          rule={editing.kind === "edit" ? editing.rule : null}
        />
      )}
    </div>
  );
}

function RuleRow({
  rule,
  canEdit,
  onEdit,
}: {
  rule: Rule;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const toggle = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("PATCH", `/quality-rules/${rule.id}`, {
      enabled: !rule.enabled,
    });
    if (succeeded(result)) router.refresh();
    else setProblem(messageFor(result));
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("DELETE", `/quality-rules/${rule.id}`);
    if (succeeded(result)) {
      setConfirming(false);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-2 px-4 py-3.5",
        !rule.enabled && "bg-sunken/60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "font-semibold [overflow-wrap:anywhere]",
                !rule.enabled && "text-text-muted",
              )}
            >
              {rule.name}
            </span>
            {rule.severity === "error" ? (
              <Stamp tone="hold">Error</Stamp>
            ) : (
              <Stamp tone="caution">Warning</Stamp>
            )}
            {rule.enabled ? null : <Stamp tone="idle">Off</Stamp>}
          </p>
          <p className="text-text-muted">{describeRule(rule)}</p>
          <p className="text-sm text-text-subtle">
            {kindInfo(rule.kind).label}
          </p>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" onClick={toggle} disabled={busy}>
              {busy ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : null}
              {rule.enabled ? "Turn off" : "Turn on"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit} disabled={busy}>
              <Pencil aria-hidden />
              Edit
              <span className="sr-only"> {rule.name}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(true)}
              disabled={busy}
            >
              <Trash2 aria-hidden />
              Delete
              <span className="sr-only"> {rule.name}</span>
            </Button>
          </div>
        ) : null}
      </div>
      {problem ? (
        <p role="alert" className="text-sm font-medium text-hold">
          {problem}
        </p>
      ) : null}

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!busy) setConfirming(open);
        }}
        title="Delete this rule?"
        description={`“${rule.name}” will stop being checked. Reports already built keep their result for it.`}
      >
        <div className="flex flex-col gap-4 p-5">
          {problem ? (
            <p role="alert" className="font-medium text-hold">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <Trash2 aria-hidden />
              )}
              Delete rule
            </Button>
          </div>
        </div>
      </Dialog>
    </li>
  );
}
