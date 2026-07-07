import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { MoodLoggerShell } from "@/components/mood-logger/MoodLoggerShell";
import { MoodStep } from "@/components/mood-logger/steps/MoodStep";
import { EmotionTagsStep } from "@/components/mood-logger/steps/EmotionTagsStep";
import { ReflectionStep } from "@/components/mood-logger/steps/ReflectionStep";
import { SleepStep } from "@/components/mood-logger/steps/SleepStep";
import { addMoodLog } from "@/services/moodLogs";
import { getCurrentUser } from "@/services/auth";

const TOTAL_STEPS = 4;

const INITIAL_STATE = {
  step: 1,
  mood: null,
  tags: [],
  reflection: "",
  sleepHours: null,
};

// Figma error states (475:9452 step 1, 473:7171 step 2, 488:6335 step 3) show
// Continue/Submit as always enabled — clicking it while a step's requirement
// isn't met reveals an inline error instead of the button ever being
// disabled. Step 4 has no Figma error link but the same treatment was
// explicitly requested. Step 3 (reflection) turns out to be required per its
// error copy, correcting the earlier "optional" assumption made before that
// spec existed. Step 2's max-3 rule is no longer validated here — since
// EmotionTagsStep now disables remaining tags once 3 are checked, a 4th
// selection is no longer reachable.
function validateStep(step, state) {
  switch (step) {
    case 1:
      return state.mood === null ? "Please select a mood before continuing." : null;
    case 2:
      return state.tags.length === 0 ? "Please select at least one tag before continuing." : null;
    case 3:
      return state.reflection.trim().length === 0
        ? "Please write a few words about your day before continuing."
        : null;
    case 4:
      return state.sleepHours === null ? "Please select how many hours you slept before continuing." : null;
    default:
      return null;
  }
}

// Figma section 308:3124 ("Log Mood Components") — 4-step wizard, no
// back-navigation (confirmed absent from all 4 step screenshots), forward
// via Continue/Submit or close via the X at any step.
export function MoodLogger({ open, onClose }) {
  const [state, setState] = useState(INITIAL_STATE);
  const [error, setError] = useState(null);

  function handleClose() {
    onClose();
    setState(INITIAL_STATE);
    setError(null);
  }

  function handleContinue() {
    const validationError = validateStep(state.step, state);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    if (state.step === TOTAL_STEPS) {
      const user = getCurrentUser();
      addMoodLog({
        mood: state.mood,
        tags: state.tags,
        reflection: state.reflection,
        sleepHours: state.sleepHours,
        userEmail: user?.email,
      });
      handleClose();
      return;
    }
    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  }

  const stepConfig = {
    1: {
      heading: "How was your mood today?",
      body: (
        <MoodStep
          value={state.mood}
          onChange={(mood) => {
            setError(null);
            setState((prev) => ({ ...prev, mood }));
          }}
        />
      ),
    },
    2: {
      heading: "How did you feel?",
      subheading: "Select up to three tags:",
      body: (
        <EmotionTagsStep
          value={state.tags}
          onChange={(tags) => {
            setError(null);
            setState((prev) => ({ ...prev, tags }));
          }}
        />
      ),
    },
    3: {
      heading: "Write about your day...",
      body: (
        <ReflectionStep
          value={state.reflection}
          onChange={(reflection) => {
            setError(null);
            setState((prev) => ({ ...prev, reflection }));
          }}
        />
      ),
    },
    4: {
      heading: "How many hours did you sleep today?",
      body: (
        <SleepStep
          value={state.sleepHours}
          onChange={(sleepHours) => {
            setError(null);
            setState((prev) => ({ ...prev, sleepHours }));
          }}
        />
      ),
    },
  }[state.step];

  return (
    <Dialog open={open} onClose={handleClose} ariaLabel="Log your mood" className="w-full max-w-150">
      <MoodLoggerShell
        step={state.step}
        totalSteps={TOTAL_STEPS}
        onClose={handleClose}
        heading={stepConfig.heading}
        subheading={stepConfig.subheading}
        error={error}
        footer={
          <Button variant="primary" size="lg" className="w-full" onClick={handleContinue}>
            {state.step === TOTAL_STEPS ? "Submit" : "Continue"}
          </Button>
        }
      >
        {stepConfig.body}
      </MoodLoggerShell>
    </Dialog>
  );
}
