import { FilesView } from "@/features/files/files-view";
import { filtersFromParams } from "@/features/files/filters";
import { loadFiles } from "@/features/files/load";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Files" };

export default async function Page({ searchParams }: PageProps<"/files">) {
  const session = await requireSession();
  const filters = filtersFromParams(await searchParams);
  const isAdmin = session.user.role === "admin";
  const api = apiClient(session.accessToken);

  // Only an admin can filter by who uploaded, and only for them is the list of colleagues worth fetching.
  const [page, members] = await Promise.all([
    loadFiles(session.accessToken, filters),
    isAdmin ? api.GET("/companies/me/members") : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">Files</h1>
        <p className="text-text-muted">
          Every spreadsheet your company keeps, checked on arrival.
        </p>
      </header>

      {page ? (
        <FilesView
          // A different filter is a different list: start it fresh rather than reusing the old rows.
          key={JSON.stringify(filters)}
          initial={page}
          filters={filters}
          people={members?.data ?? []}
          uploaderName={session.user.fullName}
          isAdmin={isAdmin}
        />
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load your files just now. Reload the page in a moment.
        </p>
      )}
    </div>
  );
}
