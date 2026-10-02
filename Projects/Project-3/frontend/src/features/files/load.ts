import "server-only";
import { API_ORIGIN } from "@/lib/session/config";
import type { FileFilters } from "./filters";
import { FILES_QUERY, variablesFor } from "./query";
import { type FilePage, toPage } from "./types";

/** The first page of the list, for the server to draw. `null` when the API could not be reached or refused. */
export async function loadFiles(
  accessToken: string,
  filters: FileFilters,
): Promise<FilePage | null> {
  try {
    const response = await fetch(`${API_ORIGIN}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: FILES_QUERY,
        variables: variablesFor(filters, null),
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return toPage(await response.json());
  } catch {
    return null;
  }
}
