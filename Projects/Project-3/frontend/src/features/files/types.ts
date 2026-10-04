import { isRecord } from "@/lib/guards";

export const REPORT_STATUSES = [
  "queued",
  "profiling",
  "ready",
  "failed",
  "unsupported",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function toStatus(value: unknown): ReportStatus | null {
  return REPORT_STATUSES.find((status) => status === value) ?? null;
}

export type Visibility = "company" | "restricted";

export function toVisibility(value: unknown): Visibility | null {
  return value === "company" || value === "restricted" ? value : null;
}

/** One line of the files list: only what the list shows, so one request can fill a whole page. */
export interface FileRow {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isLatest: boolean;
  visibility: Visibility;
  createdAt: string;
  uploaderName: string;
  status: ReportStatus;
  /** 0 to 100; `null` until the report is ready, or when no rule applied. */
  score: number | null;
  /** How many columns look like they hold personal or secret data. */
  sensitiveColumns: number;
}

/** "CSV", "XLS" or "XLSX", from the MIME type Gridline stored (which it read from the file's bytes). */
export function typeLabel(mimeType: string): string {
  if (mimeType === "text/csv") return "CSV";
  if (mimeType === "application/vnd.ms-excel") return "XLS";
  if (mimeType.includes("spreadsheetml")) return "XLSX";
  return "File";
}

/** Reads one file from a GraphQL answer without trusting its shape. `null` when anything is missing or the wrong kind. */
export function toRow(value: unknown): FileRow | null {
  if (!isRecord(value)) return null;
  const {
    id,
    originalName,
    mimeType,
    sizeBytes,
    version,
    isLatest,
    createdAt,
  } = value;
  const visibility = toVisibility(value.visibility);
  const uploader = isRecord(value.uploader) ? value.uploader : null;
  const report = isRecord(value.report) ? value.report : null;
  const status = report ? toStatus(report.status) : null;
  if (
    typeof id !== "string" ||
    typeof originalName !== "string" ||
    typeof mimeType !== "string" ||
    typeof sizeBytes !== "number" ||
    typeof version !== "number" ||
    typeof isLatest !== "boolean" ||
    typeof createdAt !== "string" ||
    !visibility ||
    !status ||
    typeof uploader?.fullName !== "string"
  ) {
    return null;
  }
  return {
    id,
    name: originalName,
    mimeType,
    sizeBytes,
    version,
    isLatest,
    visibility,
    createdAt,
    uploaderName: uploader.fullName,
    status,
    score:
      report && typeof report.qualityScore === "number"
        ? report.qualityScore
        : null,
    sensitiveColumns:
      report && typeof report.sensitiveColumns === "number"
        ? report.sensitiveColumns
        : 0,
  };
}

export interface FilePage {
  rows: FileRow[];
  nextCursor: string | null;
}

/** Reads `{ data: { files: { nodes, pageInfo } } }`. `null` when the answer is an error or not that shape. */
export function toPage(body: unknown): FilePage | null {
  if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.files)) {
    return null;
  }
  const { nodes, pageInfo } = body.data.files;
  if (!Array.isArray(nodes) || !isRecord(pageInfo)) return null;
  const rows = nodes.map(toRow);
  if (rows.some((row) => row === null)) return null;
  return {
    rows: rows.filter((row): row is FileRow => row !== null),
    nextCursor:
      pageInfo.hasMore === true && typeof pageInfo.nextCursor === "string"
        ? pageInfo.nextCursor
        : null,
  };
}
