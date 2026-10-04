import "server-only";
import { isRecord } from "@/lib/guards";
import { API_ORIGIN } from "@/lib/session/config";

/** What a company has saved for a dataset: the cleaning recipe, and whether every new version is cleaned by it. */
export interface DatasetSettings {
  recipe: unknown;
  autoClean: boolean;
  keyColumns: string[];
  /** Automatic cleaning is on the paid plans. */
  autoCleanAvailable: boolean;
}

/** The dataset's saved settings, or `null` when they could not be read. A dataset with none saved answers with the defaults. */
export async function loadDatasetSettings(
  accessToken: string,
  datasetId: string,
): Promise<DatasetSettings | null> {
  try {
    const response = await fetch(
      `${API_ORIGIN}/datasets/${datasetId}/settings`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body)) return null;
    return {
      recipe: body.recipe ?? null,
      autoClean: body.autoClean === true,
      keyColumns: Array.isArray(body.keyColumns)
        ? body.keyColumns.filter(
            (name): name is string => typeof name === "string",
          )
        : [],
      autoCleanAvailable: body.autoCleanAvailable === true,
    };
  } catch {
    return null;
  }
}
