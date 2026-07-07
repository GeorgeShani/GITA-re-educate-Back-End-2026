// Mock auth service — localStorage only, no real backend yet (see the
// project plan's "Next Workstream — Backend"). This exists purely so the
// Sign Up / Log In / Onboarding pages have something to call; the function
// signatures here are the contract a real API-backed implementation should
// match later. Storing plaintext passwords is NOT acceptable in production —
// this is a placeholder for local development only.

const USERS_KEY = "mood-tracker:users";
const SESSION_KEY = "mood-tracker:session";

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function signUp({ email, password }) {
  const users = readUsers();
  if (users[email]) {
    throw new Error("An account with this email already exists.");
  }
  const user = { email, password, name: "", avatarUrl: null, hasOnboarded: false };
  users[email] = user;
  writeUsers(users);
  writeSession({ email });
  return user;
}

export function logIn({ email, password }) {
  const users = readUsers();
  const user = users[email];
  if (!user || user.password !== password) {
    throw new Error("Incorrect email or password.");
  }
  writeSession({ email });
  return user;
}

export function logOut() {
  writeSession(null);
}

export function getCurrentUser() {
  const session = readSession();
  if (!session) return null;
  const users = readUsers();
  return users[session.email] ?? null;
}

export function completeOnboarding({ name, avatarUrl }) {
  const session = readSession();
  const users = readUsers();
  const user = session && users[session.email];
  if (!user) {
    throw new Error("No active session.");
  }
  user.name = name;
  user.avatarUrl = avatarUrl ?? null;
  user.hasOnboarded = true;
  users[session.email] = user;
  writeUsers(users);
  return user;
}

export function updateProfile({ name, avatarUrl }) {
  const session = readSession();
  const users = readUsers();
  const user = session && users[session.email];
  if (!user) {
    throw new Error("No active session.");
  }
  user.name = name;
  user.avatarUrl = avatarUrl ?? null;
  users[session.email] = user;
  writeUsers(users);
  return user;
}
