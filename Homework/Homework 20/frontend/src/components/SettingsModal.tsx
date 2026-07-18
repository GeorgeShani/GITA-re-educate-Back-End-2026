import { useEffect, useState, type SubmitEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSessionStore } from "../store/sessionStore";
import { USERNAME_CHECKS, isValidUsername } from "../lib/validateUsername";
import { CheckIcon, CircleIcon, XIcon } from "./icons";
import { TerminalInput } from "./TerminalInput";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const CONFIRM_PHRASE = "rm -rf /";

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const user = useSessionStore((s) => s.user);
  const updateUsername = useSessionStore((s) => s.updateUsername);
  const deleteAccount = useSessionStore((s) => s.deleteAccount);

  const [username, setUsername] = useState(user?.username ?? "");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaved, setUsernameSaved] = useState(false);

  const [dangerOpen, setDangerOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUsername(user?.username ?? "");
      setUsernameError(null);
      setUsernameSaved(false);
      setDangerOpen(false);
      setConfirmText("");
      setDeleteError(null);
    }
  }, [open, user?.username]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const usernameChanged = username.trim() !== user?.username;
  const usernameValid = isValidUsername(username);

  async function handleUsernameSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!usernameValid || !usernameChanged || savingUsername) return;

    setSavingUsername(true);
    setUsernameError(null);
    setUsernameSaved(false);
    try {
      await updateUsername(username);
      setUsernameSaved(true);
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : "Failed to update username.");
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleDelete() {
    if (confirmText !== CONFIRM_PHRASE || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account.");
      setDeleting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-lg border border-term-border bg-term-panel shadow-[0_0_40px_-10px_rgba(57,255,20,0.3)]"
          >
            <div className="flex items-center justify-between border-b border-term-border bg-black/30 px-4 py-2.5">
              <span className="text-xs text-term-muted">settings.sh</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="text-term-muted transition-colors hover:text-term-red"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-6 p-5">
              <section>
                <h2 className="mb-3 text-xs uppercase tracking-widest text-term-muted">
                  change username
                </h2>
                <form onSubmit={handleUsernameSubmit} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 rounded-md border border-term-border bg-black/30 px-3 py-2 focus-within:border-term-green/70">
                    <span className="text-term-green">~$</span>
                    <TerminalInput
                      value={username}
                      onChange={(value) => {
                        setUsername(value);
                        setUsernameSaved(false);
                      }}
                      maxLength={30}
                      className="text-term-text"
                    />
                  </div>

                  {username !== user?.username && (
                    <ul className="flex flex-col gap-1">
                      {USERNAME_CHECKS.map((check) => {
                        const passed = check.test(username);
                        return (
                          <li
                            key={check.key}
                            className={`flex items-center gap-2 text-xs ${
                              passed ? "text-term-green" : "text-term-muted"
                            }`}
                          >
                            {passed ? (
                              <CheckIcon className="h-3 w-3 shrink-0" />
                            ) : (
                              <CircleIcon className="h-3 w-3 shrink-0" />
                            )}
                            <span>{check.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {usernameError && (
                    <p className="text-sm text-term-red">! {usernameError}</p>
                  )}
                  {usernameSaved && (
                    <p className="flex items-center gap-1.5 text-sm text-term-green">
                      <CheckIcon className="h-3.5 w-3.5" /> username updated
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!usernameValid || !usernameChanged || savingUsername}
                    className="self-start rounded border border-term-cyan/60 px-4 py-1.5 text-sm text-term-cyan transition-colors hover:bg-term-cyan/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingUsername ? "saving..." : "save changes"}
                  </button>
                </form>
              </section>

              <section className="rounded-md border border-term-red/40 bg-term-red/5 p-4">
                <h2 className="mb-2 text-xs uppercase tracking-widest text-term-red">
                  danger zone
                </h2>

                {!dangerOpen ? (
                  <>
                    <p className="mb-3 text-xs text-term-muted">
                      Permanently delete your account, your score, and your answer history.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDangerOpen(true)}
                      className="rounded border border-term-red/60 px-4 py-1.5 text-sm text-term-red transition-colors hover:bg-term-red/10"
                    >
                      delete account
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-term-muted">
                      There's no undo, no trash bin, no "are you really sure" after this
                      one. In the spirit of every sysadmin's worst nightmare, prove it by
                      typing the command below. We'll even spot you the{" "}
                      <code className="text-term-amber">--no-preserve-root</code> flag
                      modern coreutils would otherwise demand.
                    </p>

                    <div className="flex items-center gap-2 rounded-md border border-term-red/50 bg-black/40 px-3 py-2">
                      <span className="text-term-red">$</span>
                      <TerminalInput
                        autoFocus
                        value={confirmText}
                        onChange={setConfirmText}
                        placeholder={CONFIRM_PHRASE}
                        spellCheck={false}
                        className="text-term-text placeholder:text-term-muted/50"
                        cursorClassName="text-term-red"
                      />
                    </div>

                    {deleteError && (
                      <p className="text-sm text-term-red">! {deleteError}</p>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={confirmText !== CONFIRM_PHRASE || deleting}
                        className="rounded border border-term-red bg-term-red/10 px-4 py-1.5 text-sm text-term-red transition-colors hover:bg-term-red/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deleting ? "wiping..." : "execute"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDangerOpen(false);
                          setConfirmText("");
                          setDeleteError(null);
                        }}
                        className="text-xs text-term-muted transition-colors hover:text-term-text"
                      >
                        cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
