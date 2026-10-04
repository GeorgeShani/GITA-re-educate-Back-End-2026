import { sensitiveLabel } from "@/features/file-detail/sensitive";
import { formatCents } from "@/lib/format/money";
import { type NotificationItem, number, strings, text } from "./types";

export type Glyph =
  | "check"
  | "alert"
  | "rules"
  | "columns"
  | "share"
  | "mention"
  | "quota"
  | "invoice"
  | "other";

export interface Described {
  glyph: Glyph;
  /** The sentence. */
  title: string;
  /** A second line, when there is more to say. */
  detail: string | null;
  /** Where it takes you, or `null` when it is only news. */
  href: string | null;
}

const PLAN_NAME: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  premium: "Premium",
};

const quoted = (name: string | null) => (name ? `“${name}”` : "a file");

const list = (items: readonly string[]) =>
  new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(
    items,
  );

/**
 * What an inbox entry says, in a sentence. The API only says WHAT happened (a type, and ids, counts and names); the words
 * are chosen here. `names` turns a person's id into their name. An entry of a kind this code does not know is still shown,
 * as a plain "something happened", rather than hidden.
 */
export function describe(
  item: NotificationItem,
  names: ReadonlyMap<string, string>,
): Described {
  const { payload } = item;
  const fileId = text(payload, "fileId");
  const file = fileId ? `/files/${fileId}` : null;
  const fileName = quoted(text(payload, "fileName"));

  switch (item.type) {
    case "report.ready":
      return {
        glyph: "check",
        title: `The report for ${fileName} is ready.`,
        detail: null,
        href: file,
      };
    case "report.failed":
      return {
        glyph: "alert",
        title: `The report for ${fileName} could not be built.`,
        detail: text(payload, "reason"),
        href: file,
      };
    case "rules.failed": {
      const failed = strings(payload, "failedRules");
      const score = number(payload, "qualityScore");
      return {
        glyph: "rules",
        title: `${fileName} failed ${failed.length === 1 ? "a rule" : `${failed.length || "some"} rules`}.`,
        detail:
          `${failed.length > 0 ? `${list(failed)}. ` : ""}${score === null ? "" : `Quality score ${score}.`}`.trim() ||
          null,
        href: file,
      };
    }
    case "file.cleaned": {
      const changed = number(payload, "changed");
      const auto = text(payload, "trigger") === "auto";
      return {
        glyph: "check",
        title: `A cleaned version of ${fileName} is ready.`,
        detail:
          changed === null
            ? null
            : `${changed.toLocaleString("en-US")} ${changed === 1 ? "cell or row" : "cells and rows"} changed${auto ? ", automatically" : ""}.`,
        href: file,
      };
    }
    case "cleaning.failed":
      return {
        glyph: "alert",
        title: `${fileName} could not be cleaned.`,
        detail: text(payload, "reason"),
        href: file,
      };
    case "file.sensitive_data": {
      const columns = Array.isArray(payload.columns)
        ? payload.columns.flatMap((entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "name" in entry &&
            "kind" in entry &&
            typeof entry.name === "string" &&
            typeof entry.kind === "string"
              ? [`${sensitiveLabel(entry.kind)} in “${entry.name}”`]
              : [],
          )
        : [];
      return {
        glyph: "alert",
        title: `${fileName} looks like it holds personal or secret data, and the whole company can see it.`,
        detail: columns.length > 0 ? `${list(columns)}.` : null,
        href: file,
      };
    }
    case "dataset.changed": {
      const version = number(payload, "version");
      const parts = (["added", "removed", "changed"] as const).flatMap(
        (field) => {
          const value = number(payload, field);
          return value === null || value === 0
            ? []
            : [`${value.toLocaleString("en-US")} ${field}`];
        },
      );
      return {
        glyph: "check",
        title: `${version === null ? "A new version" : `Version ${version}`} of ${fileName} differs from the one before it.`,
        detail: parts.length > 0 ? `${list(parts)}.` : null,
        href: file,
      };
    }
    case "dataset.schema_changed": {
      const removed = strings(payload, "columnsRemoved");
      const added = strings(payload, "columnsAdded");
      const retyped = Array.isArray(payload.typeChanges)
        ? payload.typeChanges.length
        : 0;
      const parts: string[] = [];
      if (removed.length > 0) parts.push(`removed ${list(removed)}`);
      if (retyped > 0) {
        parts.push(
          `changed the type of ${retyped} ${retyped === 1 ? "column" : "columns"}`,
        );
      }
      if (added.length > 0) parts.push(`added ${list(added)}`);
      const version = number(payload, "version");
      return {
        glyph: "columns",
        title: `${version === null ? "A new version" : `Version ${version}`} of ${fileName} changed its columns.`,
        detail: parts.length > 0 ? `It ${list(parts)}.` : null,
        href: file ? `${file}?tab=versions` : null,
      };
    }
    case "file.shared": {
      const by = names.get(text(payload, "sharedByUserId") ?? "");
      return {
        glyph: "share",
        title: `${by ?? "A colleague"} shared ${fileName} with you.`,
        detail: null,
        href: file,
      };
    }
    case "comment.mentioned": {
      const by = names.get(text(payload, "mentionedByUserId") ?? "");
      return {
        glyph: "mention",
        title: `${by ?? "A colleague"} mentioned you in a comment.`,
        detail: null,
        href: file ? `${file}?tab=comments` : null,
      };
    }
    case "quota.threshold": {
      const threshold = number(payload, "threshold");
      const used = number(payload, "filesUsed");
      const limit = number(payload, "filesLimit");
      const plan = PLAN_NAME[text(payload, "plan") ?? ""];
      const upgrade = PLAN_NAME[text(payload, "upgradeTo") ?? ""];
      const full = threshold === 100;
      return {
        glyph: "quota",
        title: full
          ? "Your company has used all of its files for this period."
          : `Your company has used ${threshold ?? 80}% of its files for this period.`,
        detail:
          `${used === null || limit === null ? "" : `${used} of ${limit}${plan ? ` on the ${plan} plan` : ""}. `}${upgrade ? `${upgrade} raises the limit.` : ""}`.trim() ||
          null,
        href: "/billing",
      };
    }
    case "invoice.finalized": {
      const total = number(payload, "totalCents");
      const id = text(payload, "invoiceId");
      return {
        glyph: "invoice",
        title: `A new invoice${total === null ? "" : ` for ${formatCents(total)}`} was issued.`,
        detail: null,
        href: id ? `/billing/invoices/${id}` : "/billing",
      };
    }
    default:
      return {
        glyph: "other",
        title: "Something happened in your company.",
        detail: null,
        href: null,
      };
  }
}
