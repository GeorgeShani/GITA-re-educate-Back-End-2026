import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { signUp } from "@/services/auth";

// Figma "Desktop - Sign Up - Error" (473:6758) — invalid email format shows
// on the email field itself. The "account already exists" error (thrown by
// signUp()) is also about the email, so it surfaces on the same field.
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!EMAIL_FORMAT_REGEX.test(email)) {
      setEmailError("Invalid email format.");
      return;
    }
    try {
      signUp({ email, password });
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setEmailError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-preset-3 text-neutral-900">Create an account</h1>
        <p className="text-preset-6-regular text-neutral-600">Join to track your daily mood and sleep with ease.</p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="signup-email" className="text-preset-6-regular text-neutral-900">
            Email address
          </label>
          <TextField
            id="signup-email"
            type="email"
            placeholder="name@mail.com"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError("");
            }}
            error={emailError}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="signup-password" className="text-preset-6-regular text-neutral-900">
            Password
          </label>
          <TextField
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Button type="submit" variant="primary" className="w-full">
          Sign Up
        </Button>
        <p className="text-center text-preset-6-regular text-neutral-600">
          Already got an account? <Link to="/login" className="text-blue-600">Log in.</Link>
        </p>
      </div>
    </form>
  );
}
