import type { OnlineUser } from "../types";

interface OnlineUsersProps {
  users: OnlineUser[];
  currentUserId: string | undefined;
}

export function OnlineUsers({ users, currentUserId }: OnlineUsersProps) {
  if (users.length === 0) {
    return <p className="text-sm text-term-muted">no one else is here yet</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {users.map((u) => (
        <li
          key={u.userId}
          className="flex items-center gap-2 truncate text-sm text-term-text"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-term-green animate-pulse" />
          <span className="truncate">{u.username}</span>
          {u.userId === currentUserId && (
            <span className="text-xs text-term-muted">(you)</span>
          )}
        </li>
      ))}
    </ul>
  );
}
