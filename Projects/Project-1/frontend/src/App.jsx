import { AuthProvider } from "@/context/AuthContext";
import { AppRouter } from "@/routes/router";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
