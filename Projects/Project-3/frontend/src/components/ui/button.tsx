import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const buttonStyles = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
    "transition-colors duration-(--duration-fast) ease-(--ease-out)",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Ink: the one solid action on a screen.
        primary: "bg-action text-on-action hover:bg-action-hover",
        // Ruled outline: every other action.
        secondary:
          "border border-line-strong bg-surface text-text hover:bg-sunken",
        // On box-board fields (marketing): the action reads against the field.
        onField: "bg-on-field text-canvas hover:bg-on-field-muted",
        onFieldOutline:
          "border border-on-field text-on-field hover:bg-field-deep",
        ghost: "text-text-muted hover:bg-sunken hover:text-text",
        // Vermilion: destructive, reserved for deletes and revocations.
        danger: "border border-hold text-hold hover:bg-hold-soft",
        link: "h-auto px-0 text-action underline hover:text-action-hover",
      },
      size: {
        sm: "h-7 px-2.5 text-sm",
        md: "h-9 px-3.5 text-base",
        lg: "h-11 px-5 text-md",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends ComponentProps<"button">,
    VariantProps<typeof buttonStyles> {
  /** Render as the child element (a Next `<Link>`, say) while keeping the button's look. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      className={cn(buttonStyles({ variant, size }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
}
