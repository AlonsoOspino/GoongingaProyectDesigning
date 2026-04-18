import { forwardRef, type HTMLAttributes } from "react";
import { clsx } from "clsx";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "rectangular", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "animate-pulse bg-surface-elevated",
          {
            "h-4 rounded": variant === "text",
            "rounded-full": variant === "circular",
            "rounded-md": variant === "rectangular",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";
