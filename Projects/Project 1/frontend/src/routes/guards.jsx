import { Navigate } from "react-router-dom";
import { getCurrentUser } from "@/services/auth";

// Logged in (regardless of onboarding status) -> away from sign-up/log-in.
// RequireAuth is the single place that redirects an un-onboarded user to
// /onboarding, so that logic isn't duplicated here.
export function RequireGuest({ children }) {
  if (getCurrentUser()) return <Navigate to="/" replace />;
  return children;
}

export function RequireAuth({ children }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.hasOnboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

export function RequireNewUser({ children }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.hasOnboarded) return <Navigate to="/" replace />;
  return children;
}
