import { createContext, useContext, useEffect, useState } from "react";
import { getToken } from "@/lib/apiClient";
import {
  signIn as signInRequest,
  signUp as signUpRequest,
  fetchCurrentUser,
  logOut as logOutRequest,
} from "@/services/auth";

// Single source of truth for "who's logged in". On mount it resolves the
// session from the stored token (GET /auth/current) exactly once, so guards
// and pages can read `user` synchronously afterward instead of each calling
// the API. `loading` covers that initial resolution — guards render nothing
// while it's true rather than bouncing a hard-refreshing user to /login.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const currentUser = await fetchCurrentUser();
        if (active) setUser(currentUser);
      } catch {
        // Invalid/expired token — apiClient already cleared it on the 401.
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSession();
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
