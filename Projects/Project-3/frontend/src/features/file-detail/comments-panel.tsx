"use client";

import {
  AtSign,
  CornerDownRight,
  LoaderCircle,
  MessageSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/cn";
import { exactTime, relativeTime } from "@/lib/format/time";

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
  people,
}: {
  fileId: string;
  comments: readonly Comment[];
  /** The conversation is longer than what was loaded. */
  more: boolean;
  meId: string;
  isAdmin: boolean;
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
      canEdit={comment.author.id === meId}
      canDelete={comment.author.id === meId || isAdmin}
      editing={editing === comment.id}
      onEdit={(on) => setEditing(on ? comment.id : null)}
      onReply={isReply ? null : () => setReplyingTo(comment.id)}
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

      <div className="border-t border-line pt-5">
        <Composer
          fileId={fileId}
          parentId={null}
          people={people}
          label="Add a comment"
          submit="Comment"
        />
      </div>
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

/** Where an unfinished `@mention` starts and what has been typed after it, when the caret is right at the end of one. */
function openMention(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const found = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  if (!found) return null;
  const query = found[2] ?? "";
  return { start: caret - query.length - 1, query };
}

const MOST_SHOWN = 6;

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
  const field = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [caret, setCaret] = useState(0);
  const [chosen, setChosen] = useState<ReadonlyMap<string, string>>(new Map());
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Typing "@" opens a list of colleagues, narrowed by what follows it.
  const mention = dismissed ? null : openMention(body, caret);
  const matches = mention
    ? people
        .filter((person) =>
          person.fullName
            .toLowerCase()
            .split(/\s+/)
            .concat(person.fullName.toLowerCase())
            .some((part) => part.startsWith(mention.query.toLowerCase())),
        )
        .slice(0, MOST_SHOWN)
    : [];
  const showList = mention !== null && people.length > 0;
  const listId = `${id}-mentions`;

  const choose = (person: Person) => {
    if (!mention) return;
    const inserted = `@${person.fullName} `;
    const next = body.slice(0, mention.start) + inserted + body.slice(caret);
    const position = mention.start + inserted.length;
    setBody(next);
    setCaret(position);
    setHighlight(0);
    setChosen((current) => new Map(current).set(person.id, person.fullName));
    // Write the text and the caret into the box now, so React finds nothing to change and the caret stays right after the name.
    const box = field.current;
    if (box) {
      box.value = next;
      box.focus();
      box.setSelectionRange(position, position);
    }
  };

  const post = async () => {
    setBusy(true);
    setProblem(null);
    // Only people whose @name is still in the text are told: deleting the words withdraws the mention.
    const mentionedUserIds = [...chosen]
      .filter(([, name]) => body.includes(`@${name}`))
      .map(([personId]) => personId);
    const result = await callApi("POST", `/files/${fileId}/comments`, {
      body,
      ...(parentId ? { parentId } : {}),
      mentionedUserIds,
    });
    if (succeeded(result)) {
      setBody("");
      setCaret(0);
      setChosen(new Map());
      onDone?.();
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Textarea
          ref={field}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && matches[highlight]
              ? `${listId}-${matches[highlight].id}`
              : undefined
          }
          value={body}
          maxLength={5000}
          placeholder="Write something your team should know…"
          onChange={(event) => {
            setBody(event.target.value);
            setCaret(event.target.selectionStart);
            setHighlight(0);
            setDismissed(false);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={(event) => {
            if (!showList) return;
            if (event.key === "ArrowDown" && matches.length > 0) {
              event.preventDefault();
              setHighlight((highlight + 1) % matches.length);
            } else if (event.key === "ArrowUp" && matches.length > 0) {
              event.preventDefault();
              setHighlight((highlight - 1 + matches.length) % matches.length);
            } else if (
              (event.key === "Enter" || event.key === "Tab") &&
              matches[highlight]
            ) {
              event.preventDefault();
              choose(matches[highlight]);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDismissed(true);
            }
          }}
          autoFocus={autoFocus}
        />
        {showList ? (
          <ul
            id={listId}
            // The suggestions of a combobox are a listbox; focus stays in the text box (aria-activedescendant), so the options are not focusable.
            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: ARIA combobox pattern
            role="listbox"
            aria-label="Colleagues to mention"
            className="absolute right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-line-strong bg-surface p-1 shadow-overlay"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-muted">
                No colleague by that name.
              </li>
            ) : (
              matches.map((person, index) => (
                // biome-ignore lint/a11y/useFocusableInteractive: ARIA combobox pattern, focus stays in the text box
                <li
                  key={person.id}
                  id={`${listId}-${person.id}`}
                  // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: ARIA combobox pattern
                  role="option"
                  aria-selected={index === highlight}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xs px-3 py-2",
                    index === highlight && "bg-sunken",
                  )}
                  onMouseDown={(event) => {
                    // Keep the caret in the box: a click must not take focus away before the name is inserted.
                    event.preventDefault();
                    choose(person);
                  }}
                  onMouseEnter={() => setHighlight(index)}
                >
                  <AtSign aria-hidden className="size-3.5 text-text-muted" />
                  <span className="truncate">{person.fullName}</span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {people.length > 0 ? (
        <p className="text-sm text-text-subtle">
          Type @ to mention a colleague. They get a notification.
        </p>
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
