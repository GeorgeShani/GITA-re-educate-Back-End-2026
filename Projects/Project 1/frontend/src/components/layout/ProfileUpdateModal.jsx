import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { AvatarUploadField } from "@/components/ui/AvatarUploadField";
import { CloseIcon } from "@/assets/icons";
import { getCurrentUser, updateProfile } from "@/services/auth";

// Figma "Update your profile" modal (473:6557 desktop, 473:6601 tablet —
// identical spacing; 473:6627 mobile — smaller px/gap). Pre-fills from the
// current user and re-syncs whenever the modal opens (discarding any
// unsaved edits from a previous cancelled open), matching how Home's
// MoodLogger refreshes its own snapshot of external state.
export function ProfileUpdateModal({ open, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (!open) return;
    const user = getCurrentUser();
    setName(user?.name ?? "");
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [open]);

  function handleSubmit(event) {
    event.preventDefault();
    updateProfile({ name, avatarUrl });
    onSaved();
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

          <AvatarUploadField avatarUrl={avatarUrl} onAvatarChange={setAvatarUrl} />
        </div>

        <Button type="submit" variant="primary" className="w-full">
          Save changes
        </Button>
      </form>
    </Dialog>
  );
}
