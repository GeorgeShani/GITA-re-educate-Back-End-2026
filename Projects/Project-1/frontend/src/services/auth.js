// Auth data access against the Mood Tracker API. Sign up / sign in store the
// returned Bearer token; everything else rides on it via apiClient. These are
// the same function signatures the old localStorage mock exposed, now async
// and network-backed — most call sites go through AuthContext rather than
// importing these directly.

import { request, setToken, clearToken } from "@/lib/apiClient";

// POST /auth/sign-up — creates the account and returns a token immediately
// (no separate login step). The new user has hasOnboarded=false.
export async function signUp({ email, password }) {
  const { token, user } = await request("/auth/sign-up", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setToken(token);
  return user;
}

// POST /auth/sign-in
export async function signIn({ email, password }) {
  const { token, user } = await request("/auth/sign-in", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setToken(token);
  return user;
}

// GET /auth/current — resolves the logged-in user from the stored token.
export async function fetchCurrentUser() {
  const { user } = await request("/auth/current");
  return user;
}

// PATCH /users/me — multipart form: `name` (required) + optional `avatar`
// file. This one endpoint covers both "complete onboarding" and "update
// profile"; the avatar is only sent when a new file was chosen, otherwise the
// server keeps the existing one.
export async function saveProfile({ name, avatarFile }) {
  const form = new FormData();
  form.append("name", name);
  if (avatarFile) form.append("avatar", avatarFile);

  const { user } = await request("/users/me", { method: "PATCH", body: form });
  return user;
}

export function logOut() {
  clearToken();
}
