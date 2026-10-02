import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentsPanel } from "@/features/file-detail/comments-panel";
import { FileHeader } from "@/features/file-detail/header";
import { PreviewPanel } from "@/features/file-detail/preview-panel";
import { ReportPanel } from "@/features/file-detail/report-panel";
import { DetailTabs, toTab } from "@/features/file-detail/tabs";
import { VersionsPanel } from "@/features/file-detail/versions-panel";
import { toStatus } from "@/features/files/types";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "File" };

const VERSIONS_PER_PAGE = 20;
const COMMENTS_LOADED = 100;

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/files/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const tab = toTab(firstOf(query.tab));
  const requestedPage = Number.parseInt(firstOf(query.page) ?? "1", 10);
  const versionsPage =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const session = await requireSession();
  const api = apiClient(session.accessToken);
  const path = { id };

  const [file, report, members, versions] = await Promise.all([
    api.GET("/files/{id}", { params: { path } }),
    api.GET("/files/{id}/report", { params: { path } }),
    api.GET("/companies/me/members"),
    api.GET("/files/{id}/versions", {
      params: {
        path,
        query: {
          page: tab === "versions" ? versionsPage : 1,
          limit: VERSIONS_PER_PAGE,
        },
      },
    }),
  ]);

  // A file the caller cannot see is a 404 (never a 403), and a malformed id is a 400: both are "no such file" to a person.
  if (file.response.status === 404 || file.response.status === 400) notFound();
  if (!file.data)
    throw new Error(`The file could not be loaded (${file.response.status}).`);

  const people = members.data ?? [];
  const nameOf = (userId: string) =>
    people.find((person) => person.id === userId)?.fullName ??
    "a former colleague";
  const isAdmin = session.user.role === "admin";
  const canManage = isAdmin || file.data.uploaderId === session.user.id;
  const canWrite = !session.company.isDemo;
  const status = toStatus(report.data?.status) ?? "queued";
  const latest =
    versions.data?.data.find((version) => version.isLatest) ?? null;

  const [preview, comments] = await Promise.all([
    tab === "preview"
      ? api.GET("/files/{id}/preview", { params: { path } })
      : null,
    tab === "comments"
      ? api.GET("/files/{id}/comments", {
          params: { path, query: { limit: COMMENTS_LOADED } },
        })
      : null,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FileHeader
        file={file.data}
        uploaderName={nameOf(file.data.uploaderId)}
        status={status}
        score={report.data?.qualityScore ?? null}
        canManage={canManage}
        canWrite={canWrite}
        people={people}
      />

      {file.data.isLatest || !latest ? null : (
        <p
          role="note"
          className="rounded-md border border-caution bg-caution-soft p-3 text-caution"
        >
          This is an older version of the file.{" "}
          <Link
            href={`/files/${latest.id}`}
            className="font-semibold underline underline-offset-2"
          >
            Go to the latest, version {latest.version}
          </Link>
          .
        </p>
      )}

      <div className="border-b border-line">
        <DetailTabs fileId={file.data.id} current={tab} />
      </div>

      <div id="tab-panel">
        {tab === "report" ? (
          report.data ? (
            <ReportPanel
              fileId={file.data.id}
              report={report.data}
              canManage={canManage && canWrite}
              isAdmin={isAdmin}
            />
          ) : (
            <Unavailable what="the report" />
          )
        ) : null}

        {tab === "preview" ? (
          <PreviewPanel preview={preview?.data ?? null} />
        ) : null}

        {tab === "versions" ? (
          versions.data ? (
            <VersionsPanel
              current={file.data}
              versions={versions.data.data}
              meta={versions.data.meta}
              nameOf={nameOf}
            />
          ) : (
            <Unavailable what="the versions" />
          )
        ) : null}

        {tab === "comments" ? (
          comments?.data ? (
            <CommentsPanel
              fileId={file.data.id}
              comments={comments.data.data}
              more={comments.data.meta.hasMore}
              meId={session.user.id}
              isAdmin={isAdmin}
              readOnly={!canWrite}
              people={people.filter((person) => person.id !== session.user.id)}
            />
          ) : (
            <Unavailable what="the comments" />
          )
        ) : null}
      </div>
    </div>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
    >
      We could not load {what} just now. Reload the page in a moment.
    </p>
  );
}
