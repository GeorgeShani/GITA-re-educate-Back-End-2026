import { Outlet } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";

// Shared wrapper for Sign Up / Log In / Onboarding (Figma "Form Container"
// pattern): gradient page background, logo, centered white card. Tablet and
// Desktop both use a fixed 530px card; Mobile goes full-width with tighter
// padding — confirmed identical across all three Figma frames per breakpoint.
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-page-gradient px-4 py-20 tablet:gap-12 tablet:px-0">
      <Logo />
      <main className="w-full rounded-2xl bg-neutral-0 px-4 py-10 shadow-lg tablet:w-132.5 tablet:px-8">
        <Outlet />
      </main>
    </div>
  );
}
