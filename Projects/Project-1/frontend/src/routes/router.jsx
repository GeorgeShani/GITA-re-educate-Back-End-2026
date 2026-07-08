import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireGuest, RequireAuth, RequireNewUser } from "@/routes/guards";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";

const SignUp = lazy(() => import("@/pages/auth/SignUp"));
const LogIn = lazy(() => import("@/pages/auth/LogIn"));
const Onboarding = lazy(() => import("@/pages/auth/Onboarding"));
const Home = lazy(() => import("@/pages/Home"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function withSuspense(element) {
  return <Suspense fallback={<FullScreenLoader />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/signup",
        element: withSuspense(
          <RequireGuest>
            <SignUp />
          </RequireGuest>,
        ),
      },
      {
        path: "/login",
        element: withSuspense(
          <RequireGuest>
            <LogIn />
          </RequireGuest>,
        ),
      },
      {
        path: "/onboarding",
        element: withSuspense(
          <RequireNewUser>
            <Onboarding />
          </RequireNewUser>,
        ),
      },
    ],
  },
  {
    path: "/",
    element: withSuspense(
      <RequireAuth>
        <AppLayout>
          <Home />
        </AppLayout>
      </RequireAuth>,
    ),
  },
  { path: "*", element: withSuspense(<NotFound />) },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
