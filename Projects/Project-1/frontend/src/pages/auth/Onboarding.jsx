import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { AvatarUploadField } from "@/components/ui/AvatarUploadField";
import { HintIcon } from "@/assets/icons";
import { fadeRise } from "@/animations/variants";
import { saveProfile } from "@/services/auth";
import { useAuth } from "@/context/AuthContext";

export default function Onboarding() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  // Preview URL (for display) and the raw file (for the multipart upload) are
  // tracked separately — the API wants the actual file, not a base64 string.
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await saveProfile({ name, avatarFile });
      setUser(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
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

        <AvatarUploadField
          avatarUrl={avatarPreview}
          onAvatarChange={({ previewUrl, file }) => {
            setAvatarPreview(previewUrl);
            setAvatarFile(file);
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Saving..." : "Start Tracking"}
        </Button>
        <AnimatePresence>
          {error && (
            <motion.div
              key="onboarding-error"
              {...fadeRise}
              className="flex items-center gap-1.5 text-preset-9 text-red-700"
            >
              <HintIcon className="size-3 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
