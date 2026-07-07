import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { AngleDownIcon, CogIcon, SignOutIcon } from "@/assets/icons";
import { getCurrentUser, logOut } from "@/services/auth";
import { popoverPanel } from "@/animations/variants";
import { cn } from "@/utils/cn";
import { ProfileUpdateModal } from "@/components/layout/ProfileUpdateModal";

// Figma "Profile Popover" (361:12110 desktop, 361:12121 tablet, 361:12132
// mobile — identical across all 3 breakpoints) plus its placement relative
// to the Navbar trigger (361:11131/11333/11536): right-aligned directly
// beneath the avatar. Since the trigger is the rightmost item in the Navbar's
// `justify-between` row, anchoring the panel with `right-0` on a `relative`
// wrapper around just the trigger reproduces Figma's "panel right edge lines
// up with the page content's right edge" without hardcoding a pixel offset
// that would only hold at one specific viewport width.
export function ProfileMenu({ avatarSrc, onProfileUpdated }) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleLogOut() {
    logOut();
    navigate("/log-in", { replace: true });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Open profile menu"
        className="flex shrink-0 cursor-pointer items-center gap-2.5"
      >
        <Avatar as="div" size="sm" src={avatarSrc} />
        <AngleDownIcon className={cn("size-3 text-neutral-900 transition-transform duration-150", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            {...popoverPanel}
            role="menu"
            className="absolute right-0 top-[calc(100%+8px)] z-dropdown min-w-50 origin-top-right rounded-lg bg-neutral-0 px-4 py-3 shadow-dropdown"
          >
            <div className="relative flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-preset-6 text-neutral-900">{user?.name || "—"}</p>
                <p className="text-preset-7 text-neutral-300">{user?.email}</p>
              </div>
              <div className="h-px w-full bg-blue-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setIsProfileModalOpen(true);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 text-left"
              >
                <CogIcon className="size-4 text-neutral-900" />
                <p className="text-preset-7 text-neutral-900">Settings</p>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogOut}
                className="flex w-full cursor-pointer items-center gap-2.5 text-left"
              >
                <SignOutIcon className="size-4 text-neutral-900" />
                <p className="text-preset-7 text-neutral-900">Log Out</p>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileUpdateModal
        open={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSaved={() => {
          setIsProfileModalOpen(false);
          onProfileUpdated?.();
        }}
      />
    </div>
  );
}
