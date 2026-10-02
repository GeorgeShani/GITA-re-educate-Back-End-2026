import type { UploadResult } from "@/features/files/upload";
import { isRecord } from "@/lib/guards";

export type { UploadResult as ApiResult };

/**
 * One call to the API from the browser, through this site's own door (`/session/api/...`), which attaches the session and
 * renews it once if it ran out. Never throws: a network fault is status `0`, so the caller has one shape to handle.
 */
export async function callApi(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<UploadResult> {
  try {
    const response = await fetch(`/session/api${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    });
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    return { status: response.status, body: parsed };
  } catch {
    return { status: 0, body: null };
  }
}

export function succeeded(result: UploadResult): boolean {
  return result.status >= 200 && result.status < 300;
}

/** A string field of a response body, or `null`. */
export function textOf(body: unknown, field: string): string | null {
  if (!isRecord(body)) return null;
  const value = body[field];
  return typeof value === "string" ? value : null;
}
