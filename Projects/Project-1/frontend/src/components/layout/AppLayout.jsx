import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/context/AuthContext";

// Shared chrome for authenticated pages (Home and anything added alongside
// it) — just the Navbar for now, no Figma spec yet for a sidebar or footer.
// The current user comes from AuthContext, so the Navbar avatar re-renders
// automatically after the Profile Update Modal saves changes.
export function AppLayout({ children }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <Navbar avatarSrc={user?.avatarUrl} />
      <main>{children}</main>
    </div>
  );
}
