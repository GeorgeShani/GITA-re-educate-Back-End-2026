import { useState } from "react";
import { useSessionStore } from "../store/sessionStore";
import { useTypewriter } from "../hooks/useTypewriter";
import { useKeyboardAnswers } from "../hooks/useKeyboardAnswers";
import { OptionButton, type OptionState } from "./OptionButton";
import { ArrowRightIcon, CursorBlock } from "./icons";
import type { AnswerResultPayload, PublicQuestion } from "../types";
import confetti from "canvas-confetti";

const LETTERS = ["a", "b", "c", "d"];

interface QuestionCardProps {
  quizId: number;
  question: PublicQuestion;
  index: number;
  total: number;
  onAnswered: (result: AnswerResultPayload) => void;
  onAdvance: () => void;
}

function fireConfetti() {
  confetti({
    particleCount: 70,
    spread: 65,
    startVelocity: 35,
    colors: ["#39ff14", "#00ff9c", "#56d8ff"],
    origin: { y: 0.65 },
  });
}

export function QuestionCard({
  quizId,
  question,
  index,
  total,
  onAnswered,
  onAdvance,
}: QuestionCardProps) {
  const submitAnswer = useSessionStore((s) => s.submitAnswer);
  
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prompt = useTypewriter(question.prompt);
  const answered = result !== null;

  function handleSelect(optionIndex: number) {
    const option = question.options[optionIndex];
    if (submitting || answered || option === undefined) return;

    setError(null);
    setSelected(option);
    setSubmitting(true);

    submitAnswer(quizId, question.id, option)
      .then((res) => {
        setResult(res);
        setSubmitting(false);
        if (res.correct) fireConfetti();
        onAnswered(res);
      })
      .catch((err: Error) => {
        setError(err.message);
        setSubmitting(false);
        setSelected(null);
      });
  }

  useKeyboardAnswers(
    question.options.length,
    handleSelect,
    answered ? onAdvance : null,
    answered,
  );

  function getState(option: string): OptionState {
    if (!result) {
      return submitting && selected === option ? "pending" : "idle";
    }

    if (option === result.correctAnswer) return "correct";
    if (option === selected && !result.correct) return "wrong";
    return "dim";
  }

  return (
    <div className={result && !result.correct ? "animate-shake" : ""}>
      <div className="mb-4 flex items-center justify-between text-xs text-term-muted">
        <span>
          Q {index + 1} / {total}
        </span>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full bg-term-green transition-[width] duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <p className="mb-5 min-h-14 text-base leading-relaxed text-term-text">
        <span className="text-term-green">{">"}</span> {prompt}
        <CursorBlock className="text-term-green" />
      </p>

      <div className="flex flex-col gap-2.5">
        {question.options.map((option, i) => (
          <OptionButton
            key={option}
            letter={LETTERS[i] ?? String(i)}
            label={option}
            state={getState(option)}
            disabled={submitting || answered}
            onClick={() => handleSelect(i)}
          />
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-term-red">! {error}</p>}

      {result && (
        <div className="mt-5 flex items-center justify-between rounded-md border border-term-border bg-black/30 px-4 py-3">
          <span
            className={`text-sm ${result.correct ? "text-term-green" : "text-term-red"}`}
          >
            {result.correct ? "Correct." : "Incorrect."}{" "}
            {result.alreadyAnswered && result.awardedPoints === 0 && (
              <span className="text-term-muted">
                already solved, no points
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            {result.awardedPoints > 0 && (
              <span className="animate-pop font-semibold text-term-green">
                +{result.awardedPoints}
              </span>
            )}
            <button
              type="button"
              onClick={onAdvance}
              className="flex items-center gap-1.5 rounded border border-term-cyan/60 px-3 py-1.5 text-xs text-term-cyan transition-colors hover:bg-term-cyan/10"
            >
              next [enter] <ArrowRightIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
