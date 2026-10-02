import { toVisibility, type Visibility } from "./types";

export type FileTypeFilter = "CSV" | "XLS" | "XLSX";

/** What the filter bar can narrow the list by. It lives in the address, so a filtered view can be shared and reloaded. */
export interface FileFilters {
  sort: "NEWEST" | "OLDEST";
  type: FileTypeFilter | null;
  visibility: Visibility | null;
  uploaderId: string | null;
  /** List every version, not just the newest of each file. */
  allVersions: boolean;
}

export const NO_FILTERS: FileFilters = {
  sort: "NEWEST",
  type: null,
  visibility: null,
  uploaderId: null,
  allVersions: false,
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function toFileType(value: string | undefined): FileTypeFilter | null {
  return value === "CSV" || value === "XLS" || value === "XLSX" ? value : null;
}

/** Reads the address's query string. Anything unrecognised is ignored, never an error. */
export function filtersFromParams(
  params: Record<string, string | string[] | undefined>,
): FileFilters {
  const uploader = one(params.uploader);
  return {
    sort: one(params.sort) === "OLDEST" ? "OLDEST" : "NEWEST",
    type: toFileType(one(params.type)),
    visibility: toVisibility(one(params.visibility)),
    uploaderId: uploader && /^[0-9a-f-]{36}$/i.test(uploader) ? uploader : null,
    allVersions: one(params.versions) === "all",
  };
}

/** The query string for a set of filters: empty for the defaults, so the plain list keeps a plain address. */
export function paramsOf(filters: FileFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.sort === "OLDEST") params.set("sort", "OLDEST");
  if (filters.type) params.set("type", filters.type);
  if (filters.visibility) params.set("visibility", filters.visibility);
  if (filters.uploaderId) params.set("uploader", filters.uploaderId);
  if (filters.allVersions) params.set("versions", "all");
  return params;
}

export function isFiltered(filters: FileFilters): boolean {
  return (
    filters.type !== null ||
    filters.visibility !== null ||
    filters.uploaderId !== null ||
    filters.allVersions
  );
}
