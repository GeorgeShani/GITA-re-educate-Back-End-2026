"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeLive, watchFile } from "@/lib/realtime/live";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * Says who else is looking at this file right now. Opening the page joins the file's live room; leaving it (or closing
 * the tab) leaves it. It draws nothing while you are alone, so a quiet file stays quiet.
 */
export function PresenceBar({
  fileId,
  meId,
  people,
}: {
  fileId: string;
  meId: string;
  people: readonly { id: string; fullName: string }[];
}) {
  const [here, setHere] = useState<readonly string[]>([]);

  useEffect(() => {
    const stopListening = subscribeLive({
      onPresence: (event) => {
        if (event.fileId === fileId) setHere(event.userIds);
      },
    });
    const leave = watchFile(fileId);
    return () => {
      leave();
      stopListening();
    };
  }, [fileId]);

  const others = here
    .filter((id) => id !== meId)
    .map((id) => ({
      id,
      name:
        people.find((person) => person.id === id)?.fullName ?? "A colleague",
    }));
  if (others.length === 0) return null;

  const names = others.map((other) => other.name).join(", ");
  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 text-sm text-text-muted"
    >
      <Eye aria-hidden className="size-4" />
      <span>Also looking at this file:</span>
      <ul className="flex items-center -space-x-1.5" aria-label={names}>
        {others.map((other) => (
          <li
            key={other.id}
            title={other.name}
            className="flex size-7 items-center justify-center rounded-full border border-text bg-tag text-xs font-bold text-on-tag"
          >
            <span aria-hidden>{initials(other.name)}</span>
            <span className="sr-only">{other.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
