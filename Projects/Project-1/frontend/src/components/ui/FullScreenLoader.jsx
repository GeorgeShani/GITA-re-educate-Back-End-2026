import { Logo } from "@/components/ui/Logo";

// Shown while the session is still resolving and there's nothing cached to
// render yet (rare cold case), and as the router's Suspense fallback — so the
// app never flashes a blank background. Spinner matches the one used on Home.
export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <Logo />
      <span
        role="status"
        aria-label="Loading"
        className="size-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
      />
    </div>
  );
}
