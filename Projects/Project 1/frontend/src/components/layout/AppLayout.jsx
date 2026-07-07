import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { getCurrentUser } from "@/services/auth";

// Shared chrome for authenticated pages (Home and anything added alongside
// it) — just the Navbar for now, no Figma spec yet for a sidebar or footer.
// Owns its own snapshot of the current user (rather than Navbar calling
// getCurrentUser() directly) so the avatar shown in the Navbar can refresh
// after the Profile Update Modal saves changes.
export function AppLayout({ children }) {
  const [user, setUser] = useState(getCurrentUser);

  return (
    <div className="min-h-screen">
      <Navbar avatarSrc={user?.avatarUrl} onProfileUpdated={() => setUser(getCurrentUser())} />
      {children}
    </div>
  );
}
