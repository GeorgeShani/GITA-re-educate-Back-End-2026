import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

export default function LogIn() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn({ email, password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-preset-3 text-neutral-900">Welcome back!</h1>
        <p className="text-preset-6-regular text-neutral-600">Log in to continue tracking your mood and sleep.</p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="text-preset-6-regular text-neutral-900">
            Email address
          </label>
          <TextField
            id="login-email"
            type="email"
            placeholder="name@mail.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="text-preset-6-regular text-neutral-900">
            Password
          </label>
          <TextField
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Logging in..." : "Log In"}
        </Button>
        <p className="text-center text-preset-6-regular text-neutral-600">
          Haven't got an account? <Link to="/signup" className="text-blue-600">Sign up.</Link>
        </p>
      </div>
    </form>
  );
}
