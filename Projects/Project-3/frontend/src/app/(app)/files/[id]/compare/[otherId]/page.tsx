import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareView } from "@/features/file-detail/compare-view";
import { RowsSection } from "@/features/file-detail/rows-section";
import { apiClient, toProblem } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata: Metadata = { title: "Compare versions" };

export default async function Page({
  params,
}: PageProps<"/files/[id]/compare/[otherId]">) {
  const { id, otherId } = await params;
  const session = await requireSession();
  const result = await apiClient(session.accessToken).GET(
    "/files/{id}/compare/{otherId}",
    { params: { path: { id, otherId } } },
  );

  if (result.response.status === 404 || result.response.status === 400) {
    notFound();
  }
  const comparison = result.data;
  // 409 (a report is still being built) and 422 (not versions of one file, or a report failed) carry a sentence to show.
  const problem = comparison ? null : toProblem(result.response, result.error);

  // The row-by-row part needs the files themselves (not their reports), so it can be there when the report part is not.
  const api = apiClient(session.accessToken);
  const [rows, file, preview] = comparison
    ? await Promise.all([
        api.GET("/files/{id}/compare/{otherId}/rows", {
          params: { path: { id, otherId } },
        }),
        api.GET("/files/{id}", { params: { path: { id } } }),
        api.GET("/files/{id}/preview", {
          params: { path: { id: comparison.to.fileId } },
        }),
      ])
    : [null, null, null];
  const canSaveKeys =
    file?.data !== undefined &&
    (session.user.role === "admin" || file.data.uploaderId === session.user.id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3">
        <Link
          href={`/files/${id}?tab=versions`}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All versions
        </Link>
        <h1 className="headline text-3xl leading-[1.05] sm:text-5xl">
          {comparison ? (
            <>
              <span className="wrap-anywhere">
                {comparison.to.originalName}
              </span>
              <span className="mt-1 block text-xl font-semibold text-text-muted sm:text-2xl">
                Version{" "}
                <span className="num font-mono">{comparison.from.version}</span>{" "}
                to version{" "}
                <span className="num font-mono">{comparison.to.version}</span>
              </span>
            </>
          ) : (
            "Compare versions"
          )}
        </h1>
      </header>

      {comparison ? (
        <>
          <CompareView comparison={comparison} />
          {rows?.data && file?.data ? (
            <RowsSection
              fileId={id}
              otherId={otherId}
              datasetId={file.data.datasetId}
              diff={rows.data}
              columns={
                preview?.data?.columns.map((column) => column.name) ?? []
              }
              canSaveKeys={canSaveKeys}
            />
          ) : null}
        </>
      ) : (
        <p
          role="alert"
          className="rounded-md border border-line-strong bg-sunken p-4 text-text-muted"
        >
          {problem?.messages[0] ?? "These versions could not be compared."}
        </p>
      )}
    </div>
  );
}
