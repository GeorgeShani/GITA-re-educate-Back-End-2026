import type { FileFilters } from "./filters";

export const PAGE_SIZE = 20;

/**
 * One request fills a whole page of the list: the files, who uploaded them and where each report stands. (REST would
 * need a report call per row.) It goes through GraphQL, which applies the same visibility rule as `GET /files`.
 */
export const FILES_QUERY = `
query Files($first: Int!, $after: String, $filter: FilesFilterInput, $sort: FileSort!) {
  files(first: $first, after: $after, filter: $filter, sort: $sort) {
    nodes {
      id
      originalName
      mimeType
      sizeBytes
      version
      isLatest
      visibility
      createdAt
      uploader { fullName }
      report { status qualityScore sensitiveColumns }
    }
    pageInfo { hasMore nextCursor }
  }
}`;

/** The query's variables for a set of filters, and the cursor of the page wanted (none for the first). */
export function variablesFor(
  filters: FileFilters,
  after: string | null,
): Record<string, unknown> {
  const filter: Record<string, unknown> = { allVersions: filters.allVersions };
  if (filters.type) filter.mimeType = filters.type;
  if (filters.visibility) filter.visibility = filters.visibility;
  if (filters.uploaderId) filter.uploaderId = filters.uploaderId;
  if (filters.search) filter.search = filters.search;
  if (filters.needsAttention) filter.needsAttention = true;
  if (filters.hasSensitiveData) filter.hasSensitiveData = true;
  return {
    first: PAGE_SIZE,
    after,
    filter,
    sort: filters.sort,
  };
}
