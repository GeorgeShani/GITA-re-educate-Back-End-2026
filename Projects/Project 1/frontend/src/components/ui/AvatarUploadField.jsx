import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { HintIcon } from "@/assets/icons";
import { fadeRise } from "@/animations/variants";
import { validateAvatarFile } from "@/utils/validateAvatarFile";

// Figma "Image Upload [1.0]" — shared between Onboarding (473:7134 error
// state) and the Profile Update Modal (473:6557/6601/6627): avatar trigger +
// hidden file input + hint copy + Upload button + inline type/size error.
export function AvatarUploadField({ avatarUrl, onAvatarChange }) {
  const fileInputRef = useRef(null);
  const [fileError, setFileError] = useState("");

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setFileError(validationError);
      event.target.value = "";
      return;
    }

    setFileError("");
    const reader = new FileReader();
    reader.onload = () => onAvatarChange(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-start gap-5">
      <Avatar
        src={avatarUrl}
        aria-label="Upload profile photo"
        onClick={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        onChange={handleFileChange}
      />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-preset-6-regular text-neutral-900">Upload Image</p>
          <p className="text-preset-7 text-neutral-600">Max 3MB, PNG or JPEG</p>
        </div>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </Button>
          <AnimatePresence>
            {fileError && (
              <motion.div
                key="file-error"
                {...fadeRise}
                className="flex items-center gap-1.5 text-preset-9 text-red-700"
              >
                <HintIcon className="size-3 shrink-0" />
                <span>{fileError}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
