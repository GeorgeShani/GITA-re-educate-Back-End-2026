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
  /** Part of a file name, any case. */
  search: string | null;
  /** Only files whose report failed or scored under 80. */
  needsAttention: boolean;
  /** Only files whose report found personal or secret data. */
  hasSensitiveData: boolean;
}

export const NO_FILTERS: FileFilters = {
  sort: "NEWEST",
  type: null,
  visibility: null,
  uploaderId: null,
  allVersions: false,
  search: null,
  needsAttention: false,
  hasSensitiveData: false,
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function toFileType(value: string | undefined): FileTypeFilter | null {
  return value === "CSV" || value === "XLS" || value === "XLSX" ? value : null;
}

/** A search the API will take: trimmed, not empty, not longer than it allows. */
export function toSearch(value: string | undefined): string | null {
  const text = value?.trim().slice(0, 100);
  return text ? text : null;
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
    search: toSearch(one(params.q)),
    needsAttention: one(params.attention) === "1",
    hasSensitiveData: one(params.personal) === "1",
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
  if (filters.search) params.set("q", filters.search);
  if (filters.needsAttention) params.set("attention", "1");
  if (filters.hasSensitiveData) params.set("personal", "1");
  return params;
}

export function isFiltered(filters: FileFilters): boolean {
  return (
    filters.type !== null ||
    filters.visibility !== null ||
    filters.uploaderId !== null ||
    filters.allVersions ||
    filters.search !== null ||
    filters.needsAttention ||
    filters.hasSensitiveData
  );
}
