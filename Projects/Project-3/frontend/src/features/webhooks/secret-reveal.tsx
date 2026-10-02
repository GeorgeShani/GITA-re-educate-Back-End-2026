"use client";

import { TriangleAlert } from "lucide-react";
import { CopyButton } from "@/components/marketing/exhibits/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * The signing secret of an endpoint, shown once: right after the endpoint is made, or after the secret is replaced. Gridline
 * keeps it encrypted and never returns it again, so this is the only chance to put it in the receiver.
 */
export function SecretReveal({
  title,
  secret,
  onClose,
}: {
  title: string;
  secret: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      description="This is the only time the secret is shown."
    >
      <div className="flex flex-col gap-4 p-5">
        <p
          role="note"
          className="flex gap-2 rounded-md border border-caution bg-caution-soft p-3 text-caution"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Put it in your receiver now. It checks each delivery&apos;s
            signature against this secret. Lost it? Replace it from the
            endpoint&apos;s page.
          </span>
        </p>
        <div className="flex items-center gap-2 rounded-md border border-line-strong bg-sunken p-2">
          <code
            data-testid="new-secret"
            className="min-w-0 flex-1 font-mono text-sm [overflow-wrap:anywhere]"
          >
            {secret}
          </code>
          <CopyButton text={secret} label="Copy the secret" />
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            I have stored it
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
