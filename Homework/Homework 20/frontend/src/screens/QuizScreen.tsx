import { useEffect, useState } from "react";
import { TerminalWindow } from "../components/TerminalWindow";
import { QuestionCard } from "../components/QuestionCard";
import { ResultSummary } from "../components/ResultSummary";
import { LoadingDance } from "../components/LoadingDance";
import { apiClient, apiErrorMessage } from "../lib/api";
import { toFilename } from "../lib/slug";
import { useMinimumLoading } from "../hooks/useMinimumLoading";
import { ArrowLeftIcon } from "../components/icons";
import type { AnswerResultPayload, PublicQuiz } from "../types";

interface QuizScreenProps {
  quizId: number;
  onExit: () => void;
}

export function QuizScreen({ quizId, onExit }: QuizScreenProps) {
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<AnswerResultPayload[]>([]);
  const [finished, setFinished] = useState(false);
  const showLoader = useMinimumLoading(!quiz && !loadError);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getQuiz(quizId)
      .then((data) => {
        if (!cancelled) setQuiz(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  function handleAnswered(result: AnswerResultPayload) {
    setResults((prev) => [...prev, result]);
  }

  function handleAdvance() {
    if (!quiz) return;
    if (currentIndex + 1 < quiz.questions.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      setFinished(true);
    }
  }

  const correctCount = results.filter((r) => r.correct).length;
  const pointsEarned = results.reduce((sum, r) => sum + r.awardedPoints, 0);

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-4">
      <button
        type="button"
        onClick={onExit}
        className="flex items-center gap-1.5 self-start text-xs text-term-muted transition-colors hover:text-term-cyan"
      >
        <ArrowLeftIcon className="h-3 w-3" /> back to lobby
      </button>

      <TerminalWindow filename={quiz && !showLoader ? toFilename(quiz.topic) : "loading.ts"}>
        {showLoader && <LoadingDance />}

        {!showLoader && loadError && (
          <p className="text-sm text-term-red">! {loadError}</p>
        )}

        {!showLoader && quiz && !finished && (
          <>
            <p className="mb-4 text-xs uppercase tracking-widest text-term-muted">
              {quiz.title}
            </p>
            <QuestionCard
              key={quiz.questions[currentIndex]?.id}
              quizId={quiz.id}
              question={quiz.questions[currentIndex]!}
              index={currentIndex}
              total={quiz.questions.length}
              onAnswered={handleAnswered}
              onAdvance={handleAdvance}
            />
          </>
        )}

        {quiz && finished && (
          <ResultSummary
            quizTitle={quiz.title}
            correctCount={correctCount}
            totalCount={quiz.questions.length}
            pointsEarned={pointsEarned}
            onBackToLobby={onExit}
          />
        )}
      </TerminalWindow>
    </div>
  );
}
