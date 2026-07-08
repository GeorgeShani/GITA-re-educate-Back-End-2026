import { createContext, useContext, useEffect, useState } from "react";
import { getToken, getCachedUser, setCachedUser } from "@/lib/apiClient";
import {
  signIn as signInRequest,
  signUp as signUpRequest,
  fetchCurrentUser,
  logOut as logOutRequest,
} from "@/services/auth";

// Single source of truth for "who's logged in", with stale-while-revalidate:
// the last-known user is cached in localStorage, so on reload the app renders
// immediately from that cache instead of blocking on GET /auth/current. The
// server check still runs, just in the background. `loading` is therefore only
// true in the rare cold case — a token exists but nothing is cached yet — so
// guards briefly show a loader instead of the whole app going blank.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Only trust the cached user when there's actually a token — never show a
  // logged-in UI without a credential to back it.
  const hasToken = Boolean(getToken());
  const cachedUser = hasToken ? getCachedUser() : null;
  const [user, setUserState] = useState(cachedUser);
  // Wait only when we have a session to resolve but nothing to show yet.
  const [loading, setLoading] = useState(hasToken && !cachedUser);

  // Keep the cache in step with every user change, so callers (signIn/signUp,
  // Onboarding, ProfileUpdateModal) don't each have to remember to persist.
  function setUser(nextUser) {
    setCachedUser(nextUser);
    setUserState(nextUser);
  }

  useEffect(() => {
    if (!getToken()) return;

    let active = true;

    // Revalidate in the background — updates the cache if the profile changed,
    // and logs out if the token turned out to be expired/invalid.
    fetchCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        // Invalid/expired token — apiClient already cleared token + cache.
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function signIn(credentials) {
    const loggedInUser = await signInRequest(credentials);
    setUser(loggedInUser);
    return loggedInUser;
  }

  async function signUp(credentials) {
    const newUser = await signUpRequest(credentials);
    setUser(newUser);
    return newUser;
  }

  function logOut() {
    logOutRequest();
    setUser(null);
  }

  const value = { user, loading, signIn, signUp, logOut, setUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
