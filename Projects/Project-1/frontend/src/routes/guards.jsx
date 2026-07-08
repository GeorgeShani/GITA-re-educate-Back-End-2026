import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";

// All three guards wait out AuthContext's initial session resolution
// (`loading`) before deciding, so a hard refresh or deep link doesn't flash
// the wrong route while GET /auth/current is in flight. With cached-user
// hydration, `loading` is only true in the rare no-cache cold case, so this
// loader is shown briefly then — not on every reload.

// Logged in (regardless of onboarding status) -> away from sign-up/log-in.
// RequireAuth is the single place that redirects an un-onboarded user to
// /onboarding, so that logic isn't duplicated here.
export function RequireGuest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.hasOnboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

export function RequireNewUser({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.hasOnboarded) return <Navigate to="/" replace />;
  return children;
}
