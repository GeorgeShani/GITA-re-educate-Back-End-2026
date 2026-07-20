import { quizzes } from "../data/quizzes";
import { shuffle } from "../utils/shuffle";
import type {
  PublicQuiz,
  Paginated,
  QuizListOptions,
  QuizSortKey,
  SortOrder,
} from "../types/quiz";

/** Fraction of `quiz` already answered, from a "quizId:questionId" key set. */
function completionOf(quiz: (typeof quizzes)[number], answeredQuestions: string[]): number {
  const prefix = `${quiz.id}:`;
  const answered = answeredQuestions.filter((k) => k.startsWith(prefix)).length;
  return quiz.questions.length === 0 ? 0 : answered / quiz.questions.length;
}

/**
 * Comparator for the quiz list. `default` preserves source (id) order;
 * `title`/`topic` compare case-insensitively; `progress` ranks by completion
 * fraction (asc = incomplete first, desc = completed first). `order` flips
 * the direction for every key. Ties resolve to id order for free: Array.sort
 * is stability-guaranteed, and the input is already sorted by id.
 */
function compareQuizzes(sort: QuizSortKey, order: SortOrder, answeredQuestions: string[]) {
  const dir = order === "desc" ? -1 : 1;
  return (a: (typeof quizzes)[number], b: (typeof quizzes)[number]): number => {
    if (sort === "title") return dir * a.title.localeCompare(b.title);
    if (sort === "progress") {
      return dir * (completionOf(a, answeredQuestions) - completionOf(b, answeredQuestions));
    }
    return dir * (a.id - b.id);
  };
}

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
    filename: quiz.filename,
    questions: withShuffle ? shuffle(questions) : questions,
  };
}

/**
 * Quiz logic. Quizzes live in memory (see `data/quizzes.ts`); this service is
 * the only place allowed to read the hidden `correctIndex`.
 */
export const quizService = {
  /**
   * A sorted, paginated page of quizzes, stripped of their correct answers.
   * Sorting is applied to the whole set before slicing; only the page's items
   * are mapped through `toPublicQuiz`, so we never shuffle quizzes we won't return.
   */
  getPublicQuizzes(options: QuizListOptions): Paginated<PublicQuiz> {
    const { page, limit, sort, order, withShuffle, answeredQuestions } = options;

    const total = quizzes.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * limit;

    const sorted = [...quizzes].sort(compareQuizzes(sort, order, answeredQuestions));
    const data = sorted
      .slice(start, start + limit)
      .map((quiz) => toPublicQuiz(quiz, withShuffle));

    return { data, page: safePage, limit, total, totalPages };
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
