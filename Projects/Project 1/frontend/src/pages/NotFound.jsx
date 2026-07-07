import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/layout/PageContainer";
import { MOODS } from "@/constants/moods";

// No Figma spec for this — the app has no 404 screen designed, so tone/copy
// here just follows the same friendly voice as the rest of the app (Home's
// greeting, the Mood Logger) rather than a generic framework error page.
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <PageContainer
      as="main"
      className="flex min-h-screen flex-col items-center justify-center gap-8 py-20 text-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-8"
      >
        <img src={MOODS.sad.icon} alt="" className="size-40" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-preset-3 text-blue-600">404</p>
          <h1 className="text-preset-1 text-neutral-900">This page took a mental health day.</h1>
          <p className="max-w-100 text-preset-6-regular text-neutral-600">
            We couldn't find the page you're looking for. Let's get you back on track.
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate("/")}>
          Back to Home
        </Button>
      </motion.div>
    </PageContainer>
  );
}
