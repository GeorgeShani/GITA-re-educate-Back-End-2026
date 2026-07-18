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
import { useSessionStore } from "../store/sessionStore";
import { useMinimumLoading } from "../hooks/useMinimumLoading";
import { apiClient, apiErrorMessage } from "../lib/api";
import type { PublicQuiz } from "../types";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showLoader = useMinimumLoading(loading);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setLoading(true);
    Promise.all([apiClient.getQuizzes(), apiClient.getUser(user.id)])
      .then(([quizList, profile]) => {
        if (cancelled) return;
        setQuizzes(quizList);
        setAnsweredKeys(profile.answeredQuestions);
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
  }, [user]);

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
          <h2 className="mb-3 text-xs uppercase tracking-widest text-term-muted">
            available quizzes
          </h2>

          {showLoader && <LoadingDance />}
          {!showLoader && loadError && (
            <p className="text-sm text-term-red">! {loadError}</p>
          )}

          {!showLoader && !loadError && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {quizzes.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  quiz={quiz}
                  answeredCount={answeredCountFor(quiz.id)}
                  onPlay={() => onPlay(quiz.id)}
                />
              ))}
            </div>
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
