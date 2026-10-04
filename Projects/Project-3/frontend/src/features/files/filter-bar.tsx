"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputStyles } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  type FileFilters,
  isFiltered,
  NO_FILTERS,
  paramsOf,
  toFileType,
  toSearch,
} from "./filters";
import { toVisibility } from "./types";

interface Person {
  id: string;
  fullName: string;
}

const selectStyles = cn(inputStyles(), "h-8 w-auto pr-7 text-sm");

/**
 * What the list is narrowed by. The choice is written into the address, so a filtered view can be reloaded and shared, and
 * the server draws the new first page (a filter change is a navigation, not a client-side guess about what is on the server).
 */
export function FilterBar({
  filters,
  people,
}: {
  filters: FileFilters;
  /** Everyone an admin can filter by; empty for an employee, who sees only what they may anyway. */
  people: readonly Person[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [typed, setTyped] = useState(filters.search ?? "");

  const go = (next: FileFilters) => {
    const query = paramsOf(next).toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  };

  return (
    <fieldset
      aria-busy={pending}
      className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0"
    >
      <legend className="sr-only">Filter files</legend>
      <search className="contents">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            go({ ...filters, search: toSearch(typed) });
          }}
        >
          <label className="sr-only" htmlFor="filter-search">
            Search by file name
          </label>
          <input
            id="filter-search"
            type="search"
            value={typed}
            maxLength={100}
            placeholder="Search by name"
            className={cn(inputStyles(), "h-8 w-44 text-sm")}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={() => {
              if (toSearch(typed) !== filters.search) {
                go({ ...filters, search: toSearch(typed) });
              }
            }}
          />
        </form>
      </search>
      <label className="sr-only" htmlFor="filter-type">
        Type
      </label>
      <select
        id="filter-type"
        className={selectStyles}
        value={filters.type ?? ""}
        onChange={(event) =>
          go({
            ...filters,
            type: toFileType(event.target.value),
          })
        }
      >
        <option value="">All types</option>
        <option value="CSV">CSV</option>
        <option value="XLSX">XLSX</option>
        <option value="XLS">XLS</option>
      </select>

      <label className="sr-only" htmlFor="filter-visibility">
        Who can see
      </label>
      <select
        id="filter-visibility"
        className={selectStyles}
        value={filters.visibility ?? ""}
        onChange={(event) =>
          go({ ...filters, visibility: toVisibility(event.target.value) })
        }
      >
        <option value="">Anyone can see</option>
        <option value="company">Whole company</option>
        <option value="restricted">Restricted</option>
      </select>

      {people.length > 0 ? (
        <>
          <label className="sr-only" htmlFor="filter-uploader">
            Uploaded by
          </label>
          <select
            id="filter-uploader"
            className={selectStyles}
            value={filters.uploaderId ?? ""}
            onChange={(event) =>
              go({ ...filters, uploaderId: event.target.value || null })
            }
          >
            <option value="">Anyone uploaded</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <label className="sr-only" htmlFor="filter-sort">
        Order
      </label>
      <select
        id="filter-sort"
        className={selectStyles}
        value={filters.sort}
        onChange={(event) =>
          go({
            ...filters,
            sort: event.target.value === "OLDEST" ? "OLDEST" : "NEWEST",
          })
        }
      >
        <option value="NEWEST">Newest first</option>
        <option value="OLDEST">Oldest first</option>
      </select>

      <label className="flex h-8 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-text"
          checked={filters.needsAttention}
          onChange={(event) =>
            go({ ...filters, needsAttention: event.target.checked })
          }
        />
        Needs a look
      </label>

      <label className="flex h-8 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-text"
          checked={filters.hasSensitiveData}
          onChange={(event) =>
            go({ ...filters, hasSensitiveData: event.target.checked })
          }
        />
        Has personal data
      </label>

      <label className="flex h-8 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-text"
          checked={filters.allVersions}
          onChange={(event) =>
            go({ ...filters, allVersions: event.target.checked })
          }
        />
        Every version
      </label>

      {isFiltered(filters) ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTyped("");
            go({ ...NO_FILTERS, sort: filters.sort });
          }}
        >
          Clear filters
        </Button>
      ) : null}
    </fieldset>
  );
}
