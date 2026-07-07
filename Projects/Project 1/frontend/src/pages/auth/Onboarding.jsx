import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { AvatarUploadField } from "@/components/ui/AvatarUploadField";
import { completeOnboarding } from "@/services/auth";

export default function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);

  function handleSubmit(event) {
    event.preventDefault();
    completeOnboarding({ name, avatarUrl });
    navigate("/", { replace: true });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-preset-3 text-neutral-900">Personalize your experience</h1>
        <p className="text-preset-6-regular text-neutral-600">Add your name and a profile picture to make Mood yours.</p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="onboarding-name" className="text-preset-6-regular text-neutral-900">
            Name
          </label>
          <TextField
            id="onboarding-name"
            placeholder="Jane Appleseed"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <AvatarUploadField avatarUrl={avatarUrl} onAvatarChange={setAvatarUrl} />
      </div>

      <Button type="submit" variant="primary" className="w-full">
        Start Tracking
      </Button>
    </form>
  );
}
