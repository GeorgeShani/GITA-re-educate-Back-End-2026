import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { TerminalWindow } from "../components/TerminalWindow";
import { Logo } from "../components/Logo";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { Leaderboard } from "../components/Leaderboard";
import { OnlineUsers } from "../components/OnlineUsers";
import { QuizCard } from "../components/QuizCard";
import { SettingsModal } from "../components/SettingsModal";
import { LoadingDance } from "../components/LoadingDance";
import { ArrowLeftIcon, ArrowRightIcon } from "../components/icons";
import { TerminalSelect } from "../components/TerminalSelect";
import { useSessionStore } from "../store/sessionStore";
import { useMinimumLoading } from "../hooks/useMinimumLoading";
import { apiClient, apiErrorMessage } from "../lib/api";
import type { PublicQuiz, QuizSortKey, SortOrder } from "../types";

/** The sort dropdown's options, each mapping a single value to a sort + order. */
const SORT_OPTIONS = [
  { value: "default", label: "Default order", sort: "default", order: "asc" },
  { value: "title-asc", label: "Title (A-Z)", sort: "title", order: "asc" },
  { value: "title-desc", label: "Title (Z-A)", sort: "title", order: "desc" },
  { value: "progress-desc", label: "Completed first", sort: "progress", order: "desc" },
  { value: "progress-asc", label: "Incomplete first", sort: "progress", order: "asc" },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  sort: QuizSortKey;
  order: SortOrder;
}>;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

interface LobbyScreenProps {
  onPlay: (quizId: number) => void;
}

export function LobbyScreen({ onPlay }: LobbyScreenProps) {
  const { user, status, leaderboard, onlineCount, onlineUsers, logout } = useSessionStore(
    useShallow((s) => ({
      user: s.user,
      status: s.status,
      leaderboard: s.leaderboard,
      onlineCount: s.onlineCount,
      onlineUsers: s.onlineUsers,
      logout: s.logout,
    }))
  );
  
  const [quizzes, setQuizzes] = useState<PublicQuiz[]>([]);
  const [answeredKeys, setAnsweredKeys] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortValue, setSortValue] = useState<SortValue>("default");

  // The dancing mascot only plays on the very first load; paging/sorting after
  // that swaps the grid (dimmed) instead of replaying the ~1.8s animation.
  const showLoader = useMinimumLoading(loading) && !hasLoaded;
  const isPaging = loading && hasLoaded;

  // Progress is page-independent (answeredKeys covers every quiz), so the
  // profile is fetched once per user, not on each page/sort change.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    apiClient
      .getUser(user.id)
      .then((profile) => {
        if (!cancelled) setAnsweredKeys(profile.answeredQuestions);
      })
      .catch(() => {
        // A failed profile fetch only means progress shows 0; the quiz-page
        // effect surfaces the real load error, so this one is swallowed.
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const option = SORT_OPTIONS.find((o) => o.value === sortValue)!;

    setLoading(true);
    setLoadError(null);
    apiClient
      .getQuizzes({ page, sort: option.sort, order: option.order, userId: user.id })
      .then((result) => {
        if (cancelled) return;
        setQuizzes(result.data);
        setTotalPages(result.totalPages);
        setHasLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, page, sortValue]);

  function answeredCountFor(quizId: number): number {
    const prefix = `${quizId}:`;
    return answeredKeys.filter((k) => k.startsWith(prefix)).length;
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Logo />
          <p className="mt-1 text-xs text-term-muted">
            logged in as <span className="text-term-cyan">{user?.username}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-term-muted">
            <span className="text-term-green">{onlineCount}</span> online
          </span>
          <ConnectionStatus status={status} />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-xs text-term-muted transition-colors hover:text-term-cyan"
          >
            settings
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-xs text-term-muted transition-colors hover:text-term-red"
          >
            logout
          </button>
        </div>
      </header>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs uppercase tracking-widest text-term-muted">
              available quizzes
            </h2>
            {!showLoader && !loadError && (
              <TerminalSelect
                flag="sort"
                ariaLabel="sort quizzes"
                value={sortValue}
                options={SORT_OPTIONS}
                onChange={(v) => {
                  setSortValue(v);
                  setPage(1);
                }}
              />
            )}
          </div>

          {showLoader && <LoadingDance />}
          {!showLoader && loadError && (
            <p className="text-sm text-term-red">! {loadError}</p>
          )}

          {!showLoader && !loadError && (
            <>
              <div
                className={`grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
                  isPaging ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {quizzes.map((quiz) => (
                  <QuizCard
                    key={quiz.id}
                    quiz={quiz}
                    answeredCount={answeredCountFor(quiz.id)}
                    onPlay={() => onPlay(quiz.id)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-4 text-sm text-term-muted">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1 rounded border border-term-border px-3 py-1.5 transition-colors hover:border-term-green/60 hover:text-term-green disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeftIcon className="h-3.5 w-3.5" /> prev
                  </button>
                  <span className="font-mono text-xs">
                    page {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1 rounded border border-term-border px-3 py-1.5 transition-colors hover:border-term-green/60 hover:text-term-green disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    next <ArrowRightIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <TerminalWindow filename="leaderboard.log">
            <h2 className="mb-3 text-xs uppercase tracking-widest text-term-muted">
              live leaderboard
            </h2>
            <Leaderboard entries={leaderboard} currentUserId={user?.id} />
          </TerminalWindow>

          <TerminalWindow filename="online.log">
            <h2 className="mb-3 text-xs uppercase tracking-widest text-term-muted">
              online now ({onlineCount})
            </h2>
            <OnlineUsers users={onlineUsers} currentUserId={user?.id} />
          </TerminalWindow>
        </aside>
      </div>
    </div>
  );
}
