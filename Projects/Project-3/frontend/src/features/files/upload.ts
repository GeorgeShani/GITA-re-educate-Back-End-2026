import { isRecord } from "@/lib/guards";
import { type FileRow, toVisibility, type Visibility } from "./types";

/** The largest file the API accepts. Checking here saves a long upload that is certain to be refused. */
export const MAX_BYTES = 25 * 1024 * 1024;

const EXTENSION = /\.(csv|xls|xlsx)$/i;

/** A reason to refuse a file before sending it, or `null` when it may be sent. The API still checks the bytes. */
export function problemWith(file: File): string | null {
  if (!EXTENSION.test(file.name)) {
    return "Only CSV, XLS and XLSX files can be uploaded.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_BYTES) return "This file is over 25 MB.";
  return null;
}

export interface UploadResult {
  status: number;
  body: unknown;
}

/**
 * Sends one file through this site's own door to the API (`/session/api/files`), which attaches the session. `fetch` cannot
 * report how much of an upload has gone, so this uses XMLHttpRequest, which can. The key makes a retry harmless.
 */
export function sendFile(
  file: File,
  visibility: Visibility,
  idempotencyKey: string,
  onProgress: (share: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/session/api/files");
    request.setRequestHeader("Idempotency-Key", idempotencyKey);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        body = null;
      }
      resolve({ status: request.status, body });
    };
    request.onerror = () => resolve({ status: 0, body: null });

    const form = new FormData();
    form.append("file", file);
    form.append("visibility", visibility);
    request.send(form);
  });
}

/** What to tell a person about a refused upload: the API's own words when it gave some. */
export function messageFor(result: UploadResult): string {
  if (result.status === 0) {
    return "The upload did not reach Gridline. Check your connection and try again.";
  }
  if (result.status === 401) return "Your session ended. Sign in again.";
  if (isRecord(result.body)) {
    const { message } = result.body;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) {
      const first = message.find((item) => typeof item === "string");
      if (typeof first === "string") return first;
    }
  }
  if (result.status === 413) return "This file is over 25 MB.";
  return "That did not work. Try again.";
}

/** The new file as a list row. Its report has only just been queued, so it starts as such. */
export function rowFromUpload(
  body: unknown,
  uploaderName: string,
): FileRow | null {
  if (!isRecord(body)) return null;
  const {
    id,
    originalName,
    mimeType,
    sizeBytes,
    version,
    isLatest,
    createdAt,
  } = body;
  const visibility = toVisibility(body.visibility);
  if (
    typeof id !== "string" ||
    typeof originalName !== "string" ||
    typeof mimeType !== "string" ||
    typeof sizeBytes !== "number" ||
    typeof version !== "number" ||
    typeof isLatest !== "boolean" ||
    typeof createdAt !== "string" ||
    !visibility
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
    uploaderName,
    status: "queued",
    score: null,
  };
}
