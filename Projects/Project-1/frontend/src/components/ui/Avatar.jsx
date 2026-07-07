import { forwardRef } from "react";
import avatarEmpty from "@/assets/avatar-empty.svg";
import { cn } from "@/utils/cn";

// Figma "Avatar" component (node 161:9183): Empty (161:9189) / Filled
// (161:9199), default `size="md"` (64px). `size="sm"` (40px) is the smaller
// instance used in the Navbar's profile trigger (node 361:12208 & responsive
// equivalents). Renders as a <button> by default since it's normally used as
// an image-upload trigger (Onboarding's "Image Upload" section) — pass
// `as="div"` when nesting it inside another interactive element (the Navbar's
// profile button wraps it, and two nested <button>s would be invalid HTML).
const SIZE_CLASSES = { md: "size-16", sm: "size-10" };

export const Avatar = forwardRef(function Avatar(
  { className, src, alt = "", size = "md", as: Component = "button", ...props },
  ref,
) {
  return (
    <Component
      ref={ref}
      type={Component === "button" ? "button" : undefined}
      className={cn("relative shrink-0 overflow-hidden rounded-full", SIZE_CLASSES[size], className)}
      {...props}
    >
      {src ? <img src={src} alt={alt} className="size-full object-cover" /> : <img src={avatarEmpty} alt="" className="size-full" />}
    </Component>
  );
});
