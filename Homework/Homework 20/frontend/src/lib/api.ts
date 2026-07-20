import axios, { AxiosError } from "axios";
import type {
  ApiUser,
  Paginated,
  PublicQuiz,
  QuizSortKey,
  SortOrder,
} from "../types";

interface QuizQuery {
  page?: number;
  limit?: number;
  sort?: QuizSortKey;
  order?: SortOrder;
  /** Only consulted server-side when sort is "progress". */
  userId?: string;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

/** Extracts the backend's `{ message }` error body, falling back to a generic message. */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (typeof message === "string") return message;
  }
  
  return "Something went wrong. Please try again.";
}

export function isConflict(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 409;
}

export const apiClient = {
  async createUser(username: string): Promise<ApiUser> {
    const { data } = await api.post<ApiUser>("/users", { username });
    return data;
  },

  async getUsers(): Promise<ApiUser[]> {
    const { data } = await api.get<ApiUser[]>("/users");
    return data;
  },

  async getUser(id: string): Promise<ApiUser> {
    const { data } = await api.get<ApiUser>(`/users/${id}`);
    return data;
  },

  async updateUser(id: string, data: { username?: string }): Promise<ApiUser> {
    const { data: user } = await api.patch<ApiUser>(`/users/${id}`, data);
    return user;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  // Uses the HTTP QUERY method: a safe, idempotent read (like GET) that
  // carries its pagination + sort params in a JSON body rather than the URL.
  async getQuizzes(params: QuizQuery = {}): Promise<Paginated<PublicQuiz>> {
    const { data } = await api.request<Paginated<PublicQuiz>>({
      method: "QUERY",
      url: "/quizzes",
      data: params,
    });
    
    return data;
  },

  async getQuiz(id: number): Promise<PublicQuiz> {
    const { data } = await api.get<PublicQuiz>(`/quizzes/${id}`);
    return data;
  },
};
