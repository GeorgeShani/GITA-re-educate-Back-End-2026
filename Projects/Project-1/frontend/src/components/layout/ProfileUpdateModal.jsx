import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { AvatarUploadField } from "@/components/ui/AvatarUploadField";
import { CloseIcon, HintIcon } from "@/assets/icons";
import { fadeRise } from "@/animations/variants";
import { saveProfile } from "@/services/auth";
import { useAuth } from "@/context/AuthContext";

// Figma "Update your profile" modal (473:6557 desktop, 473:6601 tablet —
// identical spacing; 473:6627 mobile — smaller px/gap). Pre-fills from the
// current user and re-syncs whenever the modal opens (discarding any unsaved
// edits from a previous cancelled open). Saving PATCHes /users/me and updates
// the shared AuthContext user, so the Navbar avatar refreshes on its own.
export function ProfileUpdateModal({ open, onClose, onSaved }) {
  const { user, setUser } = useAuth();
  const [name, setName] = useState("");
  // Display URL (existing remote avatar, or a preview of a newly picked file)
  // vs. the raw file to upload. A null file means "avatar unchanged" — the
  // server keeps the current one.
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setAvatarPreview(user?.avatarUrl ?? null);
    setAvatarFile(null);
    setError("");
  }, [open, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const updatedUser = await saveProfile({ name, avatarFile });
      setUser(updatedUser);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="Update your profile" className="w-full max-w-132.5">
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full flex-col gap-6 rounded-2xl bg-neutral-0 px-5 py-10 shadow-lg tablet:gap-8 tablet:px-10 tablet:py-12"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-7.5 right-7.5 text-neutral-600"
        >
          <CloseIcon className="size-4" />
        </button>

        <div className="flex flex-col gap-2">
          <h2 className="text-preset-3 text-neutral-900">Update your profile</h2>
          <p className="text-preset-6-regular text-neutral-600">
            Personalize your account with your name and photo.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="profile-name" className="text-preset-6-regular text-neutral-900">
              Name
            </label>
            <TextField id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required />
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
            {submitting ? "Saving..." : "Save changes"}
          </Button>
          <AnimatePresence>
            {error && (
              <motion.div
                key="profile-error"
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
    </Dialog>
  );
}
