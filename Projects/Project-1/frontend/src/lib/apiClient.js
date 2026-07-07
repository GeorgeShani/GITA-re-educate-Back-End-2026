// Thin HTTP layer over the Mood Tracker API. Attaches the Bearer token,
// serializes JSON bodies (but passes FormData through untouched so multipart
// uploads keep their auto-generated boundary), normalizes the API's
// `{ message }` error shape into thrown Errors, and clears the stored token on
// 401 so an expired/invalid session can't wedge the app.
//
// Auth is a cookieless Bearer JWT, so the token is the one thing that must
// persist client-side. It lives under a single localStorage key — all the old
// mock user/session/mood-log storage is gone.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://moodtracker-api.vercel.app";
const TOKEN_KEY = "mood-tracker:token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};

  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body != null && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }

  // Expired/invalid token — drop it so guards fall back to the logged-out
  // state instead of retrying a doomed request on every navigation.
  if (response.status === 401) clearToken();

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new Error(data?.message || "Something went wrong. Please try again.");
  }

  return data;
}
