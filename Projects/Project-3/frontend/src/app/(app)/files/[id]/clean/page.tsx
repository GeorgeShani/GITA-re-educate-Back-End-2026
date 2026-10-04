import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CleanBuilder } from "@/features/clean/clean-builder";
import { loadDatasetSettings } from "@/features/clean/load";
import { draftsFromRecipe } from "@/features/clean/steps";
import { columnsOf, suggestedSteps } from "@/features/clean/suggest";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata: Metadata = { title: "Clean a file" };

export default async function Page({ params }: PageProps<"/files/[id]/clean">) {
  const { id } = await params;
  const session = await requireSession();
  const api = apiClient(session.accessToken);
  const path = { id };
  const [file, report] = await Promise.all([
    api.GET("/files/{id}", { params: { path } }),
    api.GET("/files/{id}/report", { params: { path } }),
  ]);
  if (file.response.status === 404 || file.response.status === 400) notFound();
  if (!file.data) {
    throw new Error(`The file could not be loaded (${file.response.status}).`);
  }
  const isMine =
    session.user.role === "admin" || file.data.uploaderId === session.user.id;
  const settings = await loadDatasetSettings(
    session.accessToken,
    file.data.datasetId,
  );
  const metrics = report.data?.status === "ready" ? report.data.metrics : null;

  const saved = settings?.recipe ? draftsFromRecipe(settings.recipe) : [];
  const initial =
    saved.length > 0 ? saved : metrics ? suggestedSteps(metrics) : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href={`/files/${id}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to the file
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Clean this file
        </h1>
        <p className="max-w-prose text-text-muted wrap-anywhere">
          {file.data.originalName}, version {file.data.version}. Choose what to
          fix. Nothing is written until you create the new version, and your
          file stays as it is.
        </p>
      </header>

      {!isMine ? (
        <p
          role="note"
          className="rounded-md border border-line-strong bg-sunken p-4 text-text-muted"
        >
          Only the person who uploaded this file, or an admin, can make a
          cleaned version of it.
        </p>
      ) : !metrics ? (
        <p
          role="note"
          className="rounded-md border border-line-strong bg-sunken p-4 text-text-muted"
        >
          This file has no finished report yet, so there is nothing to base the
          steps on. Come back when it has been checked.
        </p>
      ) : (
        <CleanBuilder
          fileId={id}
          columns={columnsOf(metrics)}
          initial={initial}
          hasSavedRecipe={saved.length > 0}
          autoCleanOn={settings?.autoClean ?? false}
          canAutoClean={settings?.autoCleanAvailable ?? false}
          sheetName={metrics.sheet ? metrics.sheet.name : null}
        />
      )}
    </div>
  );
}
