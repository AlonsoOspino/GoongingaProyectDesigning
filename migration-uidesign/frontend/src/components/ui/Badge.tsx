import { forwardRef, type HTMLAttributes } from "react";
import { clsx } from "clsx";

type BadgeVariant = "default" | "primary" | "success" | "danger" | "warning" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-elevated text-muted",
  primary: "bg-primary/20 text-primary",
  success: "bg-success/20 text-success",
  danger: "bg-danger/20 text-danger",
  warning: "bg-warning/20 text-warning",
  outline: "bg-transparent border border-border text-muted",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";
