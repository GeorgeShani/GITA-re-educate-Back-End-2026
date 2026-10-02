import { ArrowLeft, FileSpreadsheet, FileText, Lock } from "lucide-react";
import Link from "next/link";
import { Stamp } from "@/components/ui/stamp";
import { ReportStamp } from "@/features/files/report-stamp";
import { type ReportStatus, typeLabel } from "@/features/files/types";
import type { components } from "@/lib/api/schema";
import { formatBytes } from "@/lib/format/bytes";
import { exactTime, relativeTime } from "@/lib/format/time";
import { DownloadButton, NewVersionButton } from "./actions";
import { DeleteButton } from "./delete-dialog";
import { ShareButton } from "./share-dialog";

type FileDto = components["schemas"]["FileDto"];

interface Person {
  id: string;
  fullName: string;
}

/** The name of the file, the facts about it, and everything that can be done to it. */
export function FileHeader({
  file,
  uploaderName,
  status,
  score,
  canManage,
  people,
}: {
  file: FileDto;
  uploaderName: string;
  status: ReportStatus;
  score: number | null;
  /** The uploader or an admin: may share and delete. */
  canManage: boolean;
  /** Colleagues a restricted file can be shared with. */
  people: readonly Person[];
}) {
  const type = typeLabel(file.mimeType);
  const Icon = type === "CSV" ? FileText : FileSpreadsheet;
  return (
    <header className="flex flex-col gap-4">
      <Link
        href="/files"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All files
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="headline flex items-start gap-3 text-3xl leading-[1.05] break-words sm:text-5xl">
            <Icon
              aria-hidden
              className="mt-1 size-7 shrink-0 text-text-muted sm:size-9"
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {file.originalName}
            </span>
          </h1>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-text-muted">
            <span className="num font-mono text-sm">{type}</span>
            <span aria-hidden>·</span>
            <span className="num font-mono text-sm">
              {formatBytes(file.sizeBytes)}
            </span>
            <span aria-hidden>·</span>
            <span>
              Version <span className="num font-mono">{file.version}</span>
            </span>
            <span aria-hidden>·</span>
            <span>
              Uploaded by {uploaderName}{" "}
              <time
                dateTime={file.createdAt}
                title={exactTime(file.createdAt)}
                suppressHydrationWarning
              >
                {relativeTime(file.createdAt)}
              </time>
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ReportStamp status={status} score={score} />
            {file.visibility === "restricted" ? (
              <Stamp tone="idle" icon={<Lock aria-hidden />}>
                Restricted
              </Stamp>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DownloadButton fileId={file.id} />
          <NewVersionButton fileId={file.id} />
          {canManage ? (
            <ShareButton
              fileId={file.id}
              visibility={file.visibility}
              granted={file.grantedUserIds ?? []}
              people={people.filter((person) => person.id !== file.uploaderId)}
            />
          ) : null}
          {canManage ? (
            <DeleteButton
              fileId={file.id}
              name={file.originalName}
              version={file.version}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
