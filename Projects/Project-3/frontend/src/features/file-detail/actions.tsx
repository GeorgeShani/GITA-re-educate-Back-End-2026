"use client";

import { Download, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { messageFor, problemWith, sendVersion } from "@/features/files/upload";
import { callApi, succeeded, textOf } from "./request";

/** What went wrong, under the buttons. Announced when it appears, gone when the next action starts. */
function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="basis-full text-sm font-medium text-hold">
      {text}
    </p>
  );
}

/** Asks for a short-lived link and follows it. The link needs no sign-in, so the browser can simply go there. */
export function DownloadButton({ fileId }: { fileId: string }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("GET", `/files/${fileId}/download`);
    const url = succeeded(result) ? textOf(result.body, "url") : null;
    if (url) window.location.assign(url);
    else setProblem(messageFor(result));
    setBusy(false);
  };

  return (
    <>
      <Button onClick={download} disabled={busy}>
        {busy ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <Download aria-hidden />
        )}
        Download
      </Button>
      <Problem text={problem} />
    </>
  );
}

/** Picks a file and sends it as the next version, then goes to that version's page. */
export function NewVersionButton({ fileId }: { fileId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [share, setShare] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async (file: File) => {
    const refused = problemWith(file);
    if (refused) {
      setProblem(refused);
      return;
    }
    setProblem(null);
    setShare(0);
    const result = await sendVersion(
      fileId,
      file,
      crypto.randomUUID(),
      setShare,
    );
    const id = textOf(result.body, "id");
    if (succeeded(result) && id) {
      router.push(`/files/${id}`);
      return;
    }
    setProblem(messageFor(result));
    setShare(null);
  };

  const sending = share !== null;
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void send(file);
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={sending}>
        {sending ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <Upload aria-hidden />
        )}
        {sending
          ? `Uploading ${Math.round((share ?? 0) * 100)}%`
          : "Upload new version"}
      </Button>
      <Problem text={problem} />
    </>
  );
}

/** Builds the report again, against the company's rules as they are today. The page updates itself as it is rebuilt. */
export function RebuildButton({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const rebuild = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("POST", `/files/${fileId}/report/rebuild`);
    if (succeeded(result)) router.refresh();
    else setProblem(messageFor(result));
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button onClick={rebuild} disabled={busy}>
        <RefreshCw aria-hidden className={busy ? "animate-spin" : undefined} />
        Check again
      </Button>
      <Problem text={problem} />
    </div>
  );
}
