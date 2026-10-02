"use client";

import {
  AtSign,
  CornerDownRight,
  LoaderCircle,
  MessageSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { messageFor } from "@/features/files/upload";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/cn";
import { exactTime, relativeTime } from "@/lib/format/time";
import { callApi, succeeded } from "./request";

type Comment = components["schemas"]["CommentDto"];

interface Person {
  id: string;
  fullName: string;
}

/**
 * The conversation about a file: top-level comments, each with its replies one level down. The server draws the list;
 * every change here is sent to the API and then the page is drawn again, so what is on screen is always what was saved.
 */
export function CommentsPanel({
  fileId,
  comments,
  more,
  meId,
  isAdmin,
  readOnly,
  people,
}: {
  fileId: string;
  comments: readonly Comment[];
  /** The conversation is longer than what was loaded. */
  more: boolean;
  meId: string;
  isAdmin: boolean;
  /** The read-only demo: comments can be read but not written. */
  readOnly: boolean;
  /** Colleagues who can be mentioned. */
  people: readonly Person[];
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const topLevel = comments.filter((comment) => comment.parentId === null);
  const repliesTo = (id: string) =>
    comments.filter((comment) => comment.parentId === id);

  const item = (comment: Comment, isReply: boolean) => (
    <CommentItem
      key={comment.id}
      comment={comment}
      isReply={isReply}
      canEdit={!readOnly && comment.author.id === meId}
      canDelete={!readOnly && (comment.author.id === meId || isAdmin)}
      editing={editing === comment.id}
      onEdit={(on) => setEditing(on ? comment.id : null)}
      onReply={isReply || readOnly ? null : () => setReplyingTo(comment.id)}
    />
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {topLevel.length === 0 ? (
        <p className="flex items-center gap-2 text-text-muted">
          <MessageSquare aria-hidden className="size-4" />
          No comments yet. Start the conversation below.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {topLevel.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-3">
              {item(comment, false)}
              {repliesTo(comment.id).length > 0 ? (
                <ul className="ml-4 flex flex-col gap-3 border-l-2 border-line pl-4 sm:ml-6">
                  {repliesTo(comment.id).map((reply) => (
                    <li key={reply.id}>{item(reply, true)}</li>
                  ))}
                </ul>
              ) : null}
              {replyingTo === comment.id ? (
                <div className="ml-4 border-l-2 border-line pl-4 sm:ml-6">
                  <Composer
                    fileId={fileId}
                    parentId={comment.id}
                    people={people}
                    label="Your reply"
                    submit="Reply"
                    autoFocus
                    onDone={() => setReplyingTo(null)}
                    onCancel={() => setReplyingTo(null)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {more ? (
        <p role="note" className="text-sm text-text-subtle">
          Only the first {comments.length} comments are shown here.
        </p>
      ) : null}

      {readOnly ? null : (
        <div className="border-t border-line pt-5">
          <Composer
            fileId={fileId}
            parentId={null}
            people={people}
            label="Add a comment"
            submit="Comment"
          />
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  isReply,
  canEdit,
  canDelete,
  editing,
  onEdit,
  onReply,
}: {
  comment: Comment;
  isReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  editing: boolean;
  onEdit: (on: boolean) => void;
  onReply: (() => void) | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (comment.deletedAt || comment.body === null) {
    return (
      <p className="text-sm text-text-subtle italic">
        {comment.author.fullName}&apos;s {isReply ? "reply" : "comment"} was
        deleted.
      </p>
    );
  }

  const remove = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("DELETE", `/comments/${comment.id}`);
    if (succeeded(result)) router.refresh();
    else setProblem(messageFor(result));
    setBusy(false);
  };

  return (
    <article className="flex flex-col gap-1.5">
      <header className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{comment.author.fullName}</span>
        <time
          dateTime={comment.createdAt}
          title={exactTime(comment.createdAt)}
          suppressHydrationWarning
          className="text-sm text-text-muted"
        >
          {relativeTime(comment.createdAt)}
        </time>
        {comment.editedAt ? (
          <span className="text-sm text-text-subtle">(edited)</span>
        ) : null}
      </header>

      {editing ? (
        <Editor comment={comment} onDone={() => onEdit(false)} />
      ) : (
        <>
          <p className="max-w-prose break-words whitespace-pre-wrap">
            {comment.body}
          </p>
          {comment.mentionedUsers.length > 0 ? (
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
              <AtSign aria-hidden className="size-3.5" />
              <span className="sr-only">Mentions</span>
              {comment.mentionedUsers.map((user) => (
                <span
                  key={user.id}
                  className="rounded-xs bg-sunken px-1.5 py-0.5 font-medium"
                >
                  {user.fullName}
                </span>
              ))}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {onReply ? (
              <Button variant="ghost" size="sm" onClick={onReply}>
                <CornerDownRight aria-hidden />
                Reply
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="ghost" size="sm" onClick={() => onEdit(true)}>
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={remove}
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle aria-hidden className="animate-spin" />
                ) : null}
                Delete
              </Button>
            ) : null}
          </div>
        </>
      )}
      {problem ? (
        <p role="alert" className="text-sm font-medium text-hold">
          {problem}
        </p>
      ) : null}
    </article>
  );
}

function Editor({ comment, onDone }: { comment: Comment; onDone: () => void }) {
  const router = useRouter();
  const [body, setBody] = useState(comment.body ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("PATCH", `/comments/${comment.id}`, { body });
    if (succeeded(result)) {
      onDone();
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label="Edit your comment"
        value={body}
        maxLength={5000}
        onChange={(event) => setBody(event.target.value)}
        autoFocus
      />
      {problem ? (
        <p role="alert" className="text-sm font-medium text-hold">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={save}
          disabled={busy || body.trim() === ""}
        >
          Save
        </Button>
        <Button size="sm" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Composer({
  fileId,
  parentId,
  people,
  label,
  submit,
  autoFocus,
  onDone,
  onCancel,
}: {
  fileId: string;
  parentId: string | null;
  people: readonly Person[];
  label: string;
  submit: string;
  autoFocus?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const post = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("POST", `/files/${fileId}/comments`, {
      body,
      ...(parentId ? { parentId } : {}),
      mentionedUserIds: [...mentioned],
    });
    if (succeeded(result)) {
      setBody("");
      setMentioned(new Set());
      onDone?.();
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  const toggle = (userId: string, on: boolean) =>
    setMentioned((current) => {
      const next = new Set(current);
      if (on) next.add(userId);
      else next.delete(userId);
      return next;
    });

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        value={body}
        maxLength={5000}
        placeholder="Write something your team should know…"
        onChange={(event) => setBody(event.target.value)}
        autoFocus={autoFocus}
      />

      {people.length > 0 ? (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text [&::-webkit-details-marker]:hidden">
            <AtSign aria-hidden className="size-3.5" />
            Mention colleagues
            {mentioned.size > 0 ? (
              <span className="num rounded-xs bg-sunken px-1.5 font-mono text-xs">
                {mentioned.size}
              </span>
            ) : null}
          </summary>
          <fieldset className="mt-2">
            <legend className="sr-only">Colleagues to notify</legend>
            <ul className="flex max-h-44 flex-col overflow-y-auto rounded-md border border-line">
              {people.map((person) => (
                <li
                  key={person.id}
                  className="border-b border-line last:border-b-0"
                >
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-sunken",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-text"
                      checked={mentioned.has(person.id)}
                      onChange={(event) =>
                        toggle(person.id, event.target.checked)
                      }
                    />
                    <span className="truncate">{person.fullName}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </details>
      ) : null}

      {problem ? (
        <p role="alert" className="text-sm font-medium text-hold">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={post}
          disabled={busy || body.trim() === ""}
        >
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
          {submit}
        </Button>
        {onCancel ? (
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
