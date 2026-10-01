import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "@/lib/api/schema";
import { isRecord } from "@/lib/guards";
import { API_ORIGIN } from "./config";

/** The typed API client for the server. Pass the visitor's access token for anything that is not public. */
export function apiClient(accessToken?: string) {
  return createClient<paths>({
    baseUrl: API_ORIGIN,
    cache: "no-store",
    ...(accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : {}),
  });
}

/** What went wrong, in words a person can act on. The API's error envelope is `{ statusCode, message, correlationId }`. */
export interface Problem {
  status: number;
  /** One or more plain sentences. Validation errors arrive as a list. */
  messages: string[];
  correlationId: string | null;
}

export function toProblem(response: Response, body: unknown): Problem {
  const messages: string[] = [];
  let correlationId: string | null = null;
  if (isRecord(body)) {
    const { message, correlationId: id } = body;
    if (typeof message === "string") messages.push(message);
    if (Array.isArray(message)) {
      for (const item of message) {
        if (typeof item === "string") messages.push(item);
      }
    }
    if (typeof id === "string") correlationId = id;
  }
  return {
    status: response.status,
    messages:
      messages.length > 0 ? messages : [fallbackMessage(response.status)],
    correlationId,
  };
}

function fallbackMessage(status: number): string {
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (status >= 500)
    return "Something went wrong on our side. Try again in a moment.";
  return "That did not work. Check what you entered and try again.";
}

/** The API could not be reached at all (down, or a network fault): not the same as being refused. */
export const UNREACHABLE: Problem = {
  status: 503,
  messages: [
    "We could not reach Gridline. Check your connection and try again.",
  ],
  correlationId: null,
};
