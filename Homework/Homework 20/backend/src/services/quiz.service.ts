import { quizzes } from "../data/quizzes";
import { shuffle } from "../utils/shuffle";
import type { PublicQuiz } from "../types/quiz";

/**
 * Strip the hidden `answer` from a quiz and (optionally) shuffle the order of
 * its questions and each question's options. Because grading is done by answer
 * *value* (see `grade`), shuffling the options never breaks scoring.
 */
function toPublicQuiz(quiz: (typeof quizzes)[number], withShuffle: boolean): PublicQuiz {
  const questions = quiz.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: withShuffle ? shuffle(q.options) : [...q.options],
  }));

  return {
    id: quiz.id,
    topic: quiz.topic,
    title: quiz.title,
    description: quiz.description,
    questions: withShuffle ? shuffle(questions) : questions,
  };
}

/**
 * Quiz logic. Quizzes live in memory (see `data/quizzes.ts`); this service is
 * the only place allowed to read the hidden `correctIndex`.
 */
export const quizService = {
  /**
   * All quizzes, stripped of their correct answers, safe for clients.
   * @param withShuffle when true (default), question and option order is randomized.
   */
  getPublicQuizzes(withShuffle = true): PublicQuiz[] {
    return quizzes.map((quiz) => toPublicQuiz(quiz, withShuffle));
  },

  /** A single public quiz, or `null` when the id does not exist. */
  getPublicQuizById(id: number, withShuffle = true): PublicQuiz | null {
    const quiz = quizzes.find((q) => q.id === id);
    return quiz ? toPublicQuiz(quiz, withShuffle) : null;
  },

  /**
   * Grade a submitted answer to a specific question by comparing the selected
   * option's *text* against the correct one. Matching by value (not index)
   * makes grading independent of the shuffled order the client received.
   * @returns `null` if the quiz or question id is unknown, otherwise the result.
   */
  grade(
    quizId: number,
    questionId: number,
    answer: string
  ): { correct: boolean; correctAnswer: string } | null {
    const quiz = quizzes.find((q) => q.id === quizId);
    const question = quiz?.questions.find((q) => q.id === questionId);
    if (!question) return null;

    return { correct: answer === question.answer, correctAnswer: question.answer };
  },
};
