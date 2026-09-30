import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/**
 * Enters the read-only demo company without signing up. A form, not a link: the BFF route at /session/demo creates a
 * session, so it must be a POST, and it works with JavaScript off.
 */
export function DemoButton({
  variant = "secondary",
  size,
  block = false,
  children = "Explore the demo",
}: Pick<ComponentProps<typeof Button>, "variant" | "size" | "children"> & {
  /** Fill the width of the parent, like the sibling buttons in a stacked list. */
  block?: boolean;
}) {
  return (
    <form
      action="/session/demo"
      method="post"
      className={block ? "w-full" : undefined}
    >
      <Button
        type="submit"
        variant={variant}
        size={size}
        className={block ? "w-full" : undefined}
      >
        {children}
      </Button>
    </form>
  );
}
