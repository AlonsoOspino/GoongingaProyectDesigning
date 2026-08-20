import { forwardRef, type HTMLAttributes } from "react";
import { clsx } from "clsx";

type BadgeVariant = "default" | "primary" | "success" | "danger" | "warning" | "outline" | "secondary";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-2 text-text-muted",
  primary: "bg-brand/20 text-brand-bright",
  secondary: "bg-brand-bright/20 text-brand-bright",
  success: "bg-success/20 text-success",
  danger: "bg-danger/20 text-danger",
  warning: "bg-warning/20 text-warning",
  outline: "bg-transparent border border-border text-text-muted",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          "inline-flex items-center px-2 py-0.5 rounded-sm text-label font-medium",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";
