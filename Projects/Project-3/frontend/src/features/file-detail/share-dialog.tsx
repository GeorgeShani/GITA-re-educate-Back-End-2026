"use client";

import { Building2, LoaderCircle, Lock, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Visibility } from "@/features/files/types";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import { cn } from "@/lib/cn";

interface Person {
  id: string;
  fullName: string;
}

/** Who can see a file: everyone in the company, or only the uploader, admins and the colleagues ticked here. */
export function ShareButton({
  fileId,
  visibility,
  granted,
  people,
}: {
  fileId: string;
  visibility: Visibility;
  granted: readonly string[];
  /** Colleagues who can be picked (never the uploader, who always sees their own file). */
  people: readonly Person[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Visibility>(visibility);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set(granted));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const change = (next: boolean) => {
    if (busy) return;
    if (next) {
      // Start from what is saved each time, so cancelling a half-made change leaves no trace.
      setChoice(visibility);
      setChosen(new Set(granted));
      setProblem(null);
    }
    setOpen(next);
  };

  const toggle = (id: string, on: boolean) => {
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("PATCH", `/files/${fileId}`, {
      visibility: choice,
      ...(choice === "restricted" ? { grantedUserIds: [...chosen] } : {}),
    });
    if (succeeded(result)) {
      setOpen(false);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <>
      <Button onClick={() => change(true)}>
        <Share2 aria-hidden />
        Sharing
      </Button>
      <Dialog
        open={open}
        onOpenChange={change}
        title="Who can see this file"
        description="Admins and the person who uploaded it can always see it."
      >
        <div className="flex flex-col gap-5 p-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Visibility</legend>
            <Choice
              checked={choice === "company"}
              onSelect={() => setChoice("company")}
              icon={<Building2 aria-hidden />}
              title="Everyone in the company"
              note="Anyone who works here can open it."
            />
            <Choice
              checked={choice === "restricted"}
              onSelect={() => setChoice("restricted")}
              icon={<Lock aria-hidden />}
              title="Only people I choose"
              note="Nobody else can even see it exists."
            />
          </fieldset>

          {choice === "restricted" ? (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1.5 text-sm font-medium">
                Share with{" "}
                <span className="num font-mono">({chosen.size})</span>
              </legend>
              {people.length === 0 ? (
                <p className="text-text-muted">
                  There are no other colleagues in this company yet.
                </p>
              ) : (
                <ul className="flex max-h-56 flex-col overflow-y-auto rounded-md border border-line">
                  {people.map((person) => (
                    <li
                      key={person.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-sunken">
                        <input
                          type="checkbox"
                          className="size-4 accent-text"
                          checked={chosen.has(person.id)}
                          onChange={(event) =>
                            toggle(person.id, event.target.checked)
                          }
                        />
                        <span className="truncate">{person.fullName}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          ) : null}

          {problem ? (
            <p role="alert" className="font-medium text-hold">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => change(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={busy}>
              {busy ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function Choice({
  checked,
  onSelect,
  icon,
  title,
  note,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: ReactNode;
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
        name="visibility"
        className="mt-1 size-4 accent-text"
        checked={checked}
        onChange={onSelect}
      />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 font-semibold [&_svg]:size-4">
          {icon}
          {title}
        </span>
        <span className="text-sm text-text-muted">{note}</span>
      </span>
    </label>
  );
}
